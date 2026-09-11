import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { In, QueryFailedError, Repository } from 'typeorm';
import { ErrorCode } from 'src/common/constants/error-codes';
import { Locale } from 'src/common/constants/locales';
import { SyncOperationStatus, SyncOperationType, SyncResolution } from 'src/common/enums/sync.enum';
import { AppException, resolveErrorMessage, validationException } from 'src/common/errors';
import { syncOperationsTotal } from 'src/common/metrics/metrics';
import { AuthUser, BranchScope } from 'src/common/types/request.types';
import { assertOccurredAtAllowed } from 'src/common/utils';
import { FinanceTransaction } from 'src/modules/finance/entities/finance-transaction.entity';
import { CreateFinanceTransactionDto } from 'src/modules/finance/dto/finance-transaction.dto';
import { FinanceTransactionsService } from 'src/modules/finance/services/finance-transactions.service';
import { Machine } from 'src/modules/machines/entities/machine.entity';
import { MediaService } from 'src/modules/media/media.service';
import { CreateMerchantDto, CreateSubscriptionDto } from 'src/modules/merchants/dto/merchant.dto';
import { Merchant } from 'src/modules/merchants/entities/merchant.entity';
import { MerchantSubscription } from 'src/modules/merchants/entities/merchant-subscription.entity';
import { MerchantsService } from 'src/modules/merchants/merchants.service';
import { Perm, PermissionCode } from 'src/modules/roles/permissions.catalogue';
import {
  ConfirmTransferDto,
  CreateTransferDto,
  RejectTransferDto,
} from 'src/modules/transfers/dto/transfer.dto';
import { Transfer } from 'src/modules/transfers/entities/transfer.entity';
import { TransfersService } from 'src/modules/transfers/transfers.service';
import { classifyFailure } from './batch-outcome';
import { SyncBatchResponse, SyncOperationResultResponse } from './dto/responses/sync.response';
import { SyncBatchDto, SyncOperationDto } from './dto/sync.dto';
import { collectMediaReferences, resolveMediaReferences } from './media-references';

/** Which permission each queued operation spends. The global guard cannot see inside a batch. */
const REQUIRED_PERMISSION: Record<SyncOperationType, PermissionCode> = {
  [SyncOperationType.CREATE_TRANSFER]: Perm.TRANSFERS_CREATE,
  [SyncOperationType.CONFIRM_TRANSFER]: Perm.TRANSFERS_CONFIRM,
  [SyncOperationType.REJECT_TRANSFER]: Perm.TRANSFERS_REJECT,
  [SyncOperationType.CREATE_MERCHANT]: Perm.MERCHANTS_CREATE,
  [SyncOperationType.CREATE_SUBSCRIPTION]: Perm.MERCHANTS_UPDATE,
  [SyncOperationType.CREATE_FINANCE_TRANSACTION]: Perm.FINANCE_CREATE,
};

interface BatchActor {
  user: AuthUser;
  locale: Locale;
  ipAddress: string | null;
}

/**
 * The write half of offline support (`20`, `POST /sync/batch`).
 *
 * Operations run in the order the client queued them, because that order is causal — the
 * merchant is registered before the transfer that hands him a machine. Each one runs through the
 * ordinary service it would have gone through over HTTP, which is what makes the offline path and
 * the online path impossible to drift apart: there is one implementation of "create a transfer",
 * and this is a second door into it rather than a copy of it.
 *
 * Nothing is rolled back on failure. A batch is a report, not a transaction: one bad item must
 * not discard the eight hand-offs that were already recorded correctly.
 */
@Injectable()
export class SyncBatchService {
  constructor(
    private readonly transfers: TransfersService,
    private readonly merchants: MerchantsService,
    private readonly finance: FinanceTransactionsService,
    private readonly media: MediaService,
    @InjectRepository(Transfer) private readonly transferRows: Repository<Transfer>,
    @InjectRepository(Merchant) private readonly merchantRows: Repository<Merchant>,
    @InjectRepository(MerchantSubscription)
    private readonly subscriptionRows: Repository<MerchantSubscription>,
    @InjectRepository(FinanceTransaction)
    private readonly financeRows: Repository<FinanceTransaction>,
    @InjectRepository(Machine) private readonly machineRows: Repository<Machine>,
  ) {}

  async process(dto: SyncBatchDto, actor: BatchActor): Promise<SyncBatchResponse> {
    const results: SyncOperationResultResponse[] = [];

    for (const operation of dto.operations) {
      const result = await this.runOne(operation, actor);
      results.push(result);
      syncOperationsTotal.inc({ type: result.type, status: result.status });
    }

    return { results, serverTime: new Date().toISOString() };
  }

  private async runOne(
    operation: SyncOperationDto,
    actor: BatchActor,
  ): Promise<SyncOperationResultResponse> {
    try {
      this.assertPermitted(operation, actor.user);

      if (operation.occurredAt) {
        assertOccurredAtAllowed(new Date(operation.occurredAt), {
          mayBackdate: actor.user.permissions.includes(Perm.SETTINGS_MANAGE),
        });
      }

      const duplicate = await this.findDuplicate(operation, actor.user);
      if (duplicate) {
        return {
          clientUuid: operation.clientUuid,
          type: operation.type,
          status: SyncOperationStatus.DUPLICATE,
          serverId: duplicate,
        };
      }

      return {
        clientUuid: operation.clientUuid,
        type: operation.type,
        status: SyncOperationStatus.SUCCESS,
        serverId: await this.dispatch(operation, actor),
      };
    } catch (error) {
      // Two identical retries of the same offline operation, truly concurrent rather than one
      // after the other, can both pass `findDuplicate`'s check before either commits its insert
      // — this is exactly that race, caught at the only place it is actually decided: the
      // `client_uuid` unique constraint itself (`5.2`). The loser here did not create a second
      // row (the constraint saw to that); it just does not yet know the winner's id, which a
      // second, post-failure lookup now finds. Reported as `DUPLICATE`, not `FAILED`/`RETRY` —
      // a client that took this branch literally, and retried, would spend another round trip
      // to learn what this already knows.
      if (isUniqueViolation(error)) {
        const resolved = await this.findDuplicate(operation, actor.user);
        if (resolved) {
          return {
            clientUuid: operation.clientUuid,
            type: operation.type,
            status: SyncOperationStatus.DUPLICATE,
            serverId: resolved,
          };
        }
      }

      return this.toFailure(operation, actor, error);
    }
  }

  private async dispatch(operation: SyncOperationDto, actor: BatchActor): Promise<string> {
    const payload = await this.withResolvedMedia(operation.payload, actor.user.id);

    switch (operation.type) {
      case SyncOperationType.CREATE_TRANSFER: {
        const dto = await this.asDto(CreateTransferDto, {
          ...(await this.withResolvedParty(payload, actor.user.id)),
          ...(operation.occurredAt ? { occurredAt: operation.occurredAt } : {}),
          clientUuid: operation.clientUuid,
        });

        const transfer = await this.transfers.create(dto, {
          user: actor.user,
          ipAddress: actor.ipAddress,
        });
        return transfer.id;
      }

      case SyncOperationType.CONFIRM_TRANSFER: {
        const { transferId, rest } = splitTransferId(payload);
        const dto = await this.asDto(ConfirmTransferDto, rest);

        const confirmed = await this.transfers.confirm(transferId, dto, {
          user: actor.user,
          ipAddress: actor.ipAddress,
        });
        return confirmed.id;
      }

      case SyncOperationType.REJECT_TRANSFER: {
        const { transferId, rest } = splitTransferId(payload);
        const dto = await this.asDto(RejectTransferDto, rest);

        const rejected = await this.transfers.reject(transferId, dto, {
          user: actor.user,
          ipAddress: actor.ipAddress,
        });
        return rejected.id;
      }

      case SyncOperationType.CREATE_MERCHANT: {
        const dto = await this.asDto(CreateMerchantDto, {
          ...payload,
          clientUuid: operation.clientUuid,
        });

        const created = await this.merchants.create(dto, actor.user);
        return created.merchant.id;
      }

      case SyncOperationType.CREATE_SUBSCRIPTION: {
        const { merchantId, rest } = splitMerchantId(payload);
        const resolvedMerchantId = await this.resolveMerchantId(merchantId, actor.user.id);

        const dto = await this.asDto(CreateSubscriptionDto, {
          ...rest,
          clientUuid: operation.clientUuid,
        });

        const created = await this.merchants.createSubscription(
          resolvedMerchantId,
          dto,
          this.scopeFor(actor.user, Perm.MERCHANTS_READ_ALL),
          actor.user,
        );
        return created.id;
      }

      case SyncOperationType.CREATE_FINANCE_TRANSACTION: {
        const dto = await this.asDto(CreateFinanceTransactionDto, {
          ...payload,
          clientUuid: operation.clientUuid,
        });

        const result = await this.finance.create(
          dto,
          this.scopeFor(actor.user, Perm.FINANCE_READ_ALL),
          actor.user,
          actor.locale,
        );
        return result.transaction.id;
      }
    }
  }

  /**
   * Rewrites the photo ids in a payload from the ones the device made up offline to the ones the
   * uploads produced (`20`, media in offline mode). An id left unresolved is passed through and
   * reported by the operation's own media check, which returns `RETRY`.
   */
  private async withResolvedMedia(
    payload: Record<string, unknown>,
    actorId: string,
  ): Promise<Record<string, unknown>> {
    const references = collectMediaReferences(payload);
    if (references.length === 0) return payload;

    const resolved = await this.media.resolveClientUuids(references, actorId);
    return resolveMediaReferences(payload, resolved);
  }

  /**
   * A `CREATE_TRANSFER` queued while offline names its merchant receiver by whatever `toPartyId`
   * held at the time — a device-generated id when the merchant itself was registered offline in
   * the same session, a real one otherwise. `resolveMerchantId` already passes a real id straight
   * through (no row will ever match a stranger's server-assigned uuid against `client_uuid`), so
   * this can run unconditionally rather than needing to know the transfer's receiver kind first.
   */
  private async withResolvedParty(
    payload: Record<string, unknown>,
    actorId: string,
  ): Promise<Record<string, unknown>> {
    const toPartyId = payload.toPartyId;
    if (typeof toPartyId !== 'string') return payload;

    return { ...payload, toPartyId: await this.resolveMerchantId(toPartyId, actorId) };
  }

  /** Passes a real id through unchanged; rewrites a device-generated one to what it became. */
  private async resolveMerchantId(id: string, actorId: string): Promise<string> {
    const resolved = await this.merchants.resolveClientUuids([id], actorId);
    return resolved.get(id) ?? id;
  }

  /**
   * Has this operation already been applied?
   *
   * The creates answer from their `client_uuid` column. A confirmation creates no row of its own,
   * so it answers from the transfer: one this caller has already signed for is a re-push, not a
   * second signature.
   */
  private async findDuplicate(operation: SyncOperationDto, user: AuthUser): Promise<string | null> {
    switch (operation.type) {
      case SyncOperationType.CREATE_TRANSFER: {
        const row = await this.transferRows.findOne({
          where: { clientUuid: operation.clientUuid, initiatedByUserId: user.id },
          select: { id: true },
        });
        return row?.id ?? null;
      }

      case SyncOperationType.CREATE_MERCHANT: {
        const row = await this.merchantRows.findOne({
          where: { clientUuid: operation.clientUuid, createdByUserId: user.id },
          select: { id: true },
        });
        return row?.id ?? null;
      }

      case SyncOperationType.CREATE_SUBSCRIPTION: {
        const row = await this.subscriptionRows.findOne({
          where: { clientUuid: operation.clientUuid, createdBy: user.id },
          select: { id: true },
        });
        return row?.id ?? null;
      }

      case SyncOperationType.CREATE_FINANCE_TRANSACTION: {
        const row = await this.financeRows.findOne({
          where: { clientUuid: operation.clientUuid, createdBy: user.id },
          select: { id: true },
        });
        return row?.id ?? null;
      }

      case SyncOperationType.CONFIRM_TRANSFER: {
        const { transferId } = splitTransferId(operation.payload);

        const row = await this.transferRows.findOne({
          where: { id: transferId, confirmedByUserId: user.id },
          select: { id: true },
        });
        return row?.id ?? null;
      }

      // A rejection inserts no row of its own (it only flips the transfer's own status), so
      // there is no unique constraint for a race to collide on — this branch is never reached
      // from the unique-violation catch above. A genuine replay (the same reject pushed twice)
      // instead hits `assertPending` and answers `TRANSFER_NOT_PENDING`, which `classifyFailure`
      // already routes to `CONFLICT`/`MANUAL` rather than a hard failure.
      case SyncOperationType.REJECT_TRANSFER:
        return null;
    }
  }

  private assertPermitted(operation: SyncOperationDto, user: AuthUser): void {
    const required = REQUIRED_PERMISSION[operation.type];

    if (!user.permissions.includes(required)) {
      throw AppException.forbidden(ErrorCode.INSUFFICIENT_PERMISSIONS, { permission: required });
    }
  }

  /**
   * The queued payload is validated against the very DTO the REST endpoint uses, with the same
   * settings as the global pipe, so an operation cannot reach a service through this door having
   * skipped a rule the other door enforces.
   */
  private async asDto<T extends object>(
    Dto: new () => T,
    payload: Record<string, unknown>,
  ): Promise<T> {
    const instance = plainToInstance(Dto, payload, { enableImplicitConversion: false });
    const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });

    if (errors.length > 0) throw validationException(errors);

    return instance;
  }

  private async toFailure(
    operation: SyncOperationDto,
    actor: BatchActor,
    error: unknown,
  ): Promise<SyncOperationResultResponse> {
    const status: HttpStatus =
      error instanceof HttpException ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const code = error instanceof AppException ? error.code : codeForStatus(status);
    const outcome = classifyFailure(status, code);

    const result: SyncOperationResultResponse = {
      clientUuid: operation.clientUuid,
      type: operation.type,
      status: outcome.status,
      serverId: null,
      error: {
        code,
        message: resolveErrorMessage(
          code,
          actor.locale,
          error instanceof AppException ? error.params : undefined,
        ),
        ...(error instanceof AppException && error.details?.length
          ? { details: error.details }
          : {}),
      },
      resolution: outcome.resolution,
    };

    // The client never wins a custody argument, so it is told what the server actually holds —
    // that is the whole point of reporting `MANUAL` rather than silently re-queueing.
    if (outcome.resolution === SyncResolution.MANUAL) {
      const state = await this.serverStateFor(operation);
      if (state) result.serverState = state;
    }

    return result;
  }

  private async serverStateFor(
    operation: SyncOperationDto,
  ): Promise<Record<string, unknown> | null> {
    if (
      operation.type === SyncOperationType.CONFIRM_TRANSFER ||
      operation.type === SyncOperationType.REJECT_TRANSFER
    ) {
      const { transferId } = splitTransferId(operation.payload);

      const transfer = await this.transferRows.findOne({ where: { id: transferId } });
      if (!transfer) return null;

      return {
        transfer: {
          id: transfer.id,
          referenceNo: transfer.referenceNo,
          status: transfer.status,
          confirmedAt: transfer.confirmedAt?.toISOString() ?? null,
          confirmedByUserId: transfer.confirmedByUserId,
          rejectionReason: transfer.rejectionReason ?? null,
          updatedAt: transfer.updatedAt.toISOString(),
        },
      };
    }

    if (operation.type === SyncOperationType.CREATE_TRANSFER) {
      const machineIds = machineIdsIn(operation.payload);
      if (machineIds.length === 0) return null;

      const machines = await this.machineRows.find({ where: { id: In(machineIds) } });
      if (machines.length === 0) return null;

      return {
        machines: machines.map((machine) => ({
          id: machine.id,
          serial: machine.serial,
          status: machine.status,
          holderType: machine.currentHolderType,
          holderId: machine.currentHolderId,
          updatedAt: machine.updatedAt.toISOString(),
        })),
      };
    }

    return null;
  }

  private scopeFor(user: AuthUser, readAll: PermissionCode): BranchScope {
    return user.permissions.includes(readAll)
      ? { branchId: null, unrestricted: true }
      : { branchId: user.branchId, unrestricted: false };
  }
}

/**
 * A confirmation names the transfer it signs for inside its payload — the queued item has no
 * URL to carry it in. Everything else is the ordinary `ConfirmTransferDto`, which rejects
 * unknown fields, so the id has to come out before validation.
 */
function splitTransferId(payload: Record<string, unknown>): {
  transferId: string;
  rest: Record<string, unknown>;
} {
  const { transferId, ...rest } = payload;

  if (typeof transferId !== 'string' || !transferId) {
    throw new AppException(ErrorCode.VALIDATION_FAILED, {
      details: [
        {
          field: 'payload.transferId',
          constraint: 'required for CONFIRM_TRANSFER/REJECT_TRANSFER',
        },
      ],
    });
  }

  return { transferId, rest };
}

/**
 * `CREATE_SUBSCRIPTION` names its merchant inside the payload for the same reason a confirmation
 * names its transfer there: the queued item has no URL to carry it in.
 */
function splitMerchantId(payload: Record<string, unknown>): {
  merchantId: string;
  rest: Record<string, unknown>;
} {
  const { merchantId, ...rest } = payload;

  if (typeof merchantId !== 'string' || !merchantId) {
    throw new AppException(ErrorCode.VALIDATION_FAILED, {
      details: [{ field: 'payload.merchantId', constraint: 'required for CREATE_SUBSCRIPTION' }],
    });
  }

  return { merchantId, rest };
}

function machineIdsIn(payload: Record<string, unknown>): string[] {
  const items = payload.items;
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => (item as { machineId?: unknown }).machineId)
    .filter((id): id is string => typeof id === 'string');
}

function codeForStatus(status: HttpStatus): string {
  if (status === HttpStatus.BAD_REQUEST) return ErrorCode.VALIDATION_FAILED;
  if (status === HttpStatus.NOT_FOUND) return ErrorCode.NOT_FOUND;
  if (status === HttpStatus.FORBIDDEN) return ErrorCode.INSUFFICIENT_PERMISSIONS;

  return ErrorCode.INTERNAL_ERROR;
}

const PG_UNIQUE_VIOLATION = '23505';

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error as unknown as { code?: string }).code === PG_UNIQUE_VIOLATION
  );
}
