import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository, SelectQueryBuilder } from 'typeorm';
import { AuditService } from 'src/common/audit';
import { ErrorCode } from 'src/common/constants/error-codes';
import { PaginatedResult } from 'src/common/dto/paginated-result';
import { AuditAction, AuditEntityType } from 'src/common/enums';
import { MachineStatus, TERMINAL_MACHINE_STATUSES } from 'src/common/enums/machine-status.enum';
import { MediaPurpose } from 'src/common/enums/operations.enum';
import {
  PartyType,
  SignatureMethod,
  SignaturePartyRole,
  TransferStatus,
  TransferType,
  TRANSFER_TYPES,
} from 'src/common/enums/transfer.enum';
import { AppException, ErrorDetail } from 'src/common/errors';
import { AuthUser, BranchScope } from 'src/common/types/request.types';
import {
  assertOccurredAtAllowed,
  likePattern,
  nextReferenceNo,
  ReferencePrefix,
} from 'src/common/utils';
import { BusinessConfig } from 'src/config/business.config';
import {
  NotificationEntityType,
  NotificationTemplateCode,
} from 'src/common/enums/notification.enum';
import { Machine } from 'src/modules/machines/entities/machine.entity';
import { MediaService } from 'src/modules/media/media.service';
import { MerchantsService } from 'src/modules/merchants/merchants.service';
import { NotificationDispatcherService } from 'src/modules/notifications/services/notification-dispatcher.service';
import {
  dedupe as dedupeRecipients,
  NotificationRecipientsService,
  Recipient,
} from 'src/modules/notifications/services/notification-recipients.service';
import { Branch } from 'src/modules/organization/entities/branch.entity';
import { Warehouse } from 'src/modules/organization/entities/warehouse.entity';
import { Perm } from 'src/modules/roles/permissions.catalogue';
import { User } from 'src/modules/users/entities/user.entity';
import { ViolationsService } from 'src/modules/violations/violations.service';
import {
  CancelTransferDto,
  ConfirmTransferDto,
  CreateTransferDto,
  ItemAdjustmentDto,
  QueryTransfersDto,
  RejectTransferDto,
  SignatureDto,
  TransferItemDto,
  TransferRecipientsQueryDto,
} from './dto/transfer.dto';
import { Transfer } from './entities/transfer.entity';
import { TransferItem } from './entities/transfer-item.entity';
import { TransferItemPhoto } from './entities/transfer-item-photo.entity';
import { TransferSignature } from './entities/transfer-signature.entity';
import {
  ABSTRACT_PARTIES,
  partyForRole,
  roleCodeFor,
  UNREPRESENTED_PARTIES,
  USER_PARTIES,
} from './transfer-parties';
import { hashTransferPayload } from './transfer-payload';
import { receiverIsCreator, TRANSFER_RULES, TransferRule } from './transfer-rules';

export interface TransferActor {
  user: AuthUser;
  ipAddress: string | null;
}

/** What a dry-run `validate` reports, so the client can grey out the submit button before it tries. */
export interface TransferValidation {
  valid: boolean;
  problems: ErrorDetail[];
}

/** A pickable receiver. Users and warehouses arrive from different tables and read identically. */
export interface TransferRecipient {
  id: string;
  name: string;
  subtitle?: string | null;
}

/** What kind of thing the client must make the user pick as the receiver, if anything. */
export type ReceiverKind = 'USER' | 'WAREHOUSE' | 'MERCHANT' | 'NONE';

export interface CreatableTransferType {
  type: TransferType;
  receiverKind: ReceiverKind;
  /** Confirms on create: there is no counterparty account, so the sender signs for himself. */
  selfAttested: boolean;
  /** Which statuses a machine may be in to go this way. Lets the picker grey out the rest. */
  allowedFromStatuses: MachineStatus[];
}

export function receiverKindFor(rule: TransferRule): ReceiverKind {
  if (rule.toPartyOptional || ABSTRACT_PARTIES.includes(rule.to)) return 'NONE';
  // The creator is the receiver, so there is nothing for the client to ask him to choose.
  if (receiverIsCreator(rule)) return 'NONE';
  if (rule.to === PartyType.WAREHOUSE) return 'WAREHOUSE';
  if (rule.to === PartyType.MERCHANT) return 'MERCHANT';

  return 'USER';
}

@Injectable()
export class TransfersService {
  private readonly business: BusinessConfig;

  constructor(
    @InjectRepository(Transfer) private readonly transfers: Repository<Transfer>,
    @InjectRepository(TransferItem) private readonly items: Repository<TransferItem>,
    private readonly media: MediaService,
    private readonly merchants: MerchantsService,
    private readonly violations: ViolationsService,
    private readonly notifications: NotificationDispatcherService,
    private readonly recipients: NotificationRecipientsService,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    config: ConfigService,
  ) {
    this.business = config.getOrThrow<BusinessConfig>('business');
  }

  async findAll(
    query: QueryTransfersDto,
    scope: BranchScope,
    actor: AuthUser,
  ): Promise<PaginatedResult<Transfer>> {
    const qb = this.baseQuery();

    this.applyScope(qb, scope, actor);

    if (query.type?.length) {
      qb.andWhere('transfer.type IN (:...types)', { types: query.type });
    }

    if (query.status?.length) {
      qb.andWhere('transfer.status IN (:...statuses)', { statuses: query.status });
    }

    if (scope.unrestricted && query.branchId) {
      qb.andWhere('transfer.branch_id = :branchId', { branchId: query.branchId });
    }

    if (query.fromPartyId) {
      qb.andWhere('transfer.from_party_id = :fromPartyId', { fromPartyId: query.fromPartyId });
    }

    if (query.toPartyId) {
      qb.andWhere('transfer.to_party_id = :toPartyId', { toPartyId: query.toPartyId });
    }

    if (query.machineId) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM transfer_items ti WHERE ti.transfer_id = transfer.id AND ti.machine_id = :machineId)',
        { machineId: query.machineId },
      );
    }

    // Both bounds read `occurred_at`: a hand-off that happened on the 30th and synced on the 2nd
    // belongs in the 30th's report, which is the number the supervisor is checking against paper.
    if (query.dateFrom) {
      qb.andWhere('transfer.occurred_at >= :dateFrom', { dateFrom: query.dateFrom });
    }

    if (query.dateTo) {
      qb.andWhere('transfer.occurred_at <= :dateTo', { dateTo: query.dateTo });
    }

    if (query.hasViolations !== undefined) {
      // Until the violations module lands (`10`), a mismatch recorded on an item is the only
      // violation signal there is, and it is the same signal the auto-detection will act on.
      const clause = `EXISTS (
        SELECT 1 FROM transfer_items ti
        WHERE ti.transfer_id = transfer.id
          AND (ti.battery_matches = false OR ti.sim_matches = false OR ti.box_matches = false)
      )`;
      qb.andWhere(query.hasViolations ? clause : `NOT ${clause}`);
    }

    qb.orderBy('transfer.occurredAt', query.order).addOrderBy('transfer.id', 'ASC');
    qb.skip(query.skip).take(query.take);

    const [rows, total] = await qb.getManyAndCount();
    return new PaginatedResult(rows, total, query.page, query.limit);
  }

  async findById(id: string, scope: BranchScope, actor: AuthUser): Promise<Transfer> {
    const transfer = await this.detailQuery().where('transfer.id = :id', { id }).getOne();

    if (!transfer) throw AppException.notFound(ErrorCode.TRANSFER_NOT_FOUND);
    if (!this.canSee(transfer, scope, actor)) {
      throw AppException.notFound(ErrorCode.TRANSFER_NOT_FOUND);
    }

    return transfer;
  }

  /**
   * A signed URL for one signature's drawn image, for whoever can already read this transfer —
   * not whoever uploaded the media.
   *
   * `Media.signedUrl` deliberately refuses that (a media id travels in the transfer payload
   * itself, so ownership is the only thing stopping a counterparty from reading it there) — this
   * is the other door `signedUrlForAuthorizedMedia` exists for: `findById` above is the actual
   * authorization check, done against the transfer the signature belongs to, and by the time this
   * reaches media storage that question is already answered.
   */
  async signatureMedia(
    transferId: string,
    signatureId: string,
    scope: BranchScope,
    actor: AuthUser,
  ): Promise<{ url: string; expiresAt: Date; mimeType: string }> {
    const transfer = await this.findById(transferId, scope, actor);

    const signature = transfer.signatures.find((row) => row.id === signatureId);
    if (!signature || !signature.signatureMediaId) {
      throw AppException.notFound(ErrorCode.MEDIA_NOT_FOUND);
    }

    const resolved = await this.media.signedUrlForAuthorizedMedia(signature.signatureMediaId);
    if (!resolved) throw AppException.notFound(ErrorCode.MEDIA_NOT_FOUND);

    return { url: resolved.url, expiresAt: resolved.expiresAt, mimeType: resolved.media.mimeType };
  }

  /** My inbox: transfers waiting for me to sign. */
  async incoming(actor: AuthUser, query: QueryTransfersDto): Promise<PaginatedResult<Transfer>> {
    const qb = this.baseQuery()
      .where('transfer.status = :pending', { pending: TransferStatus.PENDING })
      .andWhere('transfer.to_party_id = :me', { me: actor.id })
      .orderBy('transfer.occurredAt', 'DESC')
      .skip(query.skip)
      .take(query.take);

    const [rows, total] = await qb.getManyAndCount();
    return new PaginatedResult(rows, total, query.page, query.limit);
  }

  /**
   * The inbox in full — items, photos and signatures — because a receiver who is about to lose
   * signal has to be able to check the machines against the manifest and sign for them offline
   * (`20`, bootstrap). Unpaginated: what is waiting for one person's signature is a short list.
   */
  async pendingForSignature(actor: AuthUser): Promise<Transfer[]> {
    return this.detailQuery()
      .where('transfer.status = :pending', { pending: TransferStatus.PENDING })
      .andWhere('transfer.to_party_id = :me', { me: actor.id })
      .orderBy('transfer.occurredAt', 'DESC')
      .getMany();
  }

  /**
   * Transfers addressed to the caller that stopped being his problem since `since` — signed,
   * rejected or withdrawn. The device drops them from its inbox rather than offering a
   * signature the server would refuse.
   */
  async settledSince(actor: AuthUser, since: Date): Promise<string[]> {
    const rows = await this.transfers
      .createQueryBuilder('transfer')
      .select('transfer.id', 'id')
      .where('transfer.to_party_id = :me', { me: actor.id })
      .andWhere('transfer.status <> :pending', { pending: TransferStatus.PENDING })
      .andWhere('transfer.updated_at > :since', { since })
      .getRawMany<{ id: string }>();

    return rows.map((row) => row.id);
  }

  /** What I have sent that nobody has signed for yet — the list that gets chased up. */
  async outgoing(actor: AuthUser, query: QueryTransfersDto): Promise<PaginatedResult<Transfer>> {
    const qb = this.baseQuery()
      .where('transfer.status = :pending', { pending: TransferStatus.PENDING })
      .andWhere('transfer.initiated_by_user_id = :me', { me: actor.id })
      .orderBy('transfer.occurredAt', 'DESC')
      .skip(query.skip)
      .take(query.take);

    const [rows, total] = await qb.getManyAndCount();
    return new PaginatedResult(rows, total, query.page, query.limit);
  }

  /**
   * Dry run. Runs every check `create` runs and writes nothing, so a representative standing in
   * front of a merchant finds out about a blocked machine before he has collected a signature.
   */
  async validate(dto: CreateTransferDto, actor: AuthUser): Promise<TransferValidation> {
    const rule = TRANSFER_RULES[dto.type];

    try {
      assertOccurredAtAllowed(new Date(dto.occurredAt), {
        mayBackdate: actor.permissions.includes(Perm.SETTINGS_MANAGE),
      });

      await this.dataSource.transaction(async (manager) => {
        const receiver = await this.resolveReceiver(manager, dto, rule, actor);
        this.assertSenderMayCreate(rule, actor, receiver);

        const machines = await this.lockMachines(manager, dto.items, /* lock */ false);
        await this.assertMachinesMovable(manager, dto, rule, machines, actor);
      });

      return { valid: true, problems: [] };
    } catch (error) {
      if (error instanceof AppException) {
        return {
          valid: false,
          problems: error.details ?? [{ constraint: error.code, value: error.params }],
        };
      }
      throw error;
    }
  }

  /**
   * Which hand-offs this caller may start.
   *
   * Answered here rather than derived on the device. A director and a supervisor both hold
   * `transfers.create`, but only one of them may dispatch from the company warehouse — that is a
   * property of the rules map, not of the permission, and the client should not be carrying a
   * second copy of the map that can drift from this one.
   */
  creatableTypes(actor: AuthUser): CreatableTransferType[] {
    const actorParty = partyForRole(actor.roleCode);
    if (!actorParty) return [];

    return TRANSFER_TYPES.filter((type) => {
      const rule = TRANSFER_RULES[type];

      // The same rule `create` applies: when the sending side has no login, the receiver books
      // the hand-off in, so he is the one who may start it.
      const expected = UNREPRESENTED_PARTIES.includes(rule.from) ? rule.to : rule.from;
      return actorParty === expected;
    }).map((type) => {
      const rule = TRANSFER_RULES[type];

      return {
        type,
        receiverKind: receiverKindFor(rule),
        selfAttested: rule.autoConfirm === true,
        allowedFromStatuses: [...rule.allowedFromStatuses],
      };
    });
  }

  /**
   * Who this caller may hand a given type of transfer to.
   *
   * The picker cannot be built from `GET /users`: that needs `users.read`, which a supervisor or a
   * representative has no business holding. So eligibility is answered here, by the module that
   * owns the rule, and gated on `transfers.create` — the permission the caller is about to exercise
   * anyway. `sameBranchRequired` is applied for the same reason it is applied on create: offering a
   * choice the server will refuse is worse than not offering it.
   */
  async recipientsFor(
    query: TransferRecipientsQueryDto,
    actor: AuthUser,
    scope: BranchScope,
  ): Promise<PaginatedResult<TransferRecipient>> {
    const rule = TRANSFER_RULES[query.type];
    const empty = new PaginatedResult<TransferRecipient>([], 0, query.page, query.limit);

    if (rule.to === PartyType.MERCHANT) {
      // Scoped by the merchants module rather than here: a representative is only ever offered the
      // shops he registered, and that rule belongs where the merchant list is built.
      const page = await this.merchants.pickable(query, scope, actor);

      return page.map((merchant) => ({
        id: merchant.id,
        name: merchant.name,
        subtitle: merchant.shopName,
      }));
    }

    if (rule.to === PartyType.WAREHOUSE) {
      const qb = this.dataSource
        .getRepository(Warehouse)
        .createQueryBuilder('warehouse')
        .where('warehouse.is_active = true');

      if (rule.toWarehouseTypes) {
        qb.andWhere('warehouse.type IN (:...types)', { types: [...rule.toWarehouseTypes] });
      }
      if (query.search) {
        qb.andWhere('warehouse.name ILIKE :search', { search: likePattern(query.search) });
      }

      const [rows, total] = await qb
        .orderBy('warehouse.name', 'ASC')
        .addOrderBy('warehouse.id', 'ASC')
        .skip(query.skip)
        .take(query.take)
        .getManyAndCount();

      return new PaginatedResult(
        rows.map((warehouse) => ({ id: warehouse.id, name: warehouse.name })),
        total,
        query.page,
        query.limit,
      );
    }

    if (!USER_PARTIES.includes(rule.to) || receiverIsCreator(rule)) {
      // The factory, a service centre, the scrapyard: not accounts, nothing to list. Nor is
      // there anything to list when the caller is himself the receiver.
      return empty;
    }

    // No branch means no counterparty: an unassigned account cannot be in the same branch as
    // anyone, and returning everyone would only produce a 422 on submit.
    if (rule.sameBranchRequired && !actor.branchId) return empty;

    // `User` has no branch relation, so the name is joined in raw. It is what tells two
    // same-named supervisors apart in the picker, which is the whole reason it is here.
    const qb = this.dataSource
      .getRepository(User)
      .createQueryBuilder('user')
      .innerJoin('user.role', 'role')
      .leftJoin(Branch, 'branch', 'branch.id = user.branch_id')
      .addSelect('branch.name', 'branchName')
      .where('user.is_active = true')
      .andWhere('role.code = :roleCode', { roleCode: roleCodeFor(rule.to) })
      .andWhere('user.id != :actorId', { actorId: actor.id });

    if (rule.sameBranchRequired) {
      qb.andWhere('user.branch_id = :branchId', { branchId: actor.branchId });
    }
    if (query.search) {
      qb.andWhere('user.full_name ILIKE :search', { search: likePattern(query.search) });
    }

    const total = await qb.clone().getCount();
    const { entities, raw } = await qb
      .orderBy('user.fullName', 'ASC')
      .addOrderBy('user.id', 'ASC')
      .skip(query.skip)
      .take(query.take)
      .getRawAndEntities<{ branchName: string | null }>();

    return new PaginatedResult(
      entities.map((user, index) => ({
        id: user.id,
        name: user.fullName,
        subtitle: raw[index]?.branchName ?? null,
      })),
      total,
      query.page,
      query.limit,
    );
  }

  /**
   * The create flow (`09`). Everything happens in one transaction with the machine rows locked:
   * two supervisors dispatching the same unit from two phones must not both succeed, and the check
   * that stops them is only meaningful if the row cannot change underneath it.
   */
  async create(dto: CreateTransferDto, actor: TransferActor): Promise<Transfer> {
    const rule = TRANSFER_RULES[dto.type];

    // `occurredAt` comes off a device clock nobody controls (`20`, mechanism 3). The elevated
    // escape hatch is what lets a director backfill a repair or a scrapping from months ago;
    // it is checked here rather than at the controller because the maintenance and decommission
    // flows reach this method without passing through one.
    assertOccurredAtAllowed(new Date(dto.occurredAt), {
      mayBackdate: actor.user.permissions.includes(Perm.SETTINGS_MANAGE),
    });

    // Replaying a create is the normal outcome of a flaky field connection, not an error: the
    // device retries what it could not confirm was received. Scoped to the initiator, so a
    // leaked clientUuid cannot be used to read somebody else's transfer.
    const replayed = await this.findReplay(dto.clientUuid, actor);
    if (replayed) return replayed;

    const id = await this.dataSource
      .transaction(async (manager) => {
        const receiver = await this.resolveReceiver(manager, dto, rule, actor.user);
        this.assertSenderMayCreate(rule, actor.user, receiver);

        const machines = await this.lockMachines(manager, dto.items, true);
        await this.assertMachinesMovable(manager, dto, rule, machines, actor.user);

        // On the merchant-return leg the sending party is a shop, not an account. Resolve it
        // from current custody so the transfer records *which* shop handed the machines back.
        const returningMerchantId = await this.resolveReturningMerchant(
          manager,
          rule,
          machines,
          actor,
        );

        const transfer = await manager.getRepository(Transfer).save(
          manager.getRepository(Transfer).create({
            referenceNo: await nextReferenceNo(manager, ReferencePrefix.TRANSFER),
            type: dto.type,
            direction: rule.direction,
            fromPartyType: rule.from,
            fromPartyId: returningMerchantId ?? this.senderPartyId(rule, actor.user),
            toPartyType: rule.to,
            // `resolveReceiver` returns null for abstract receivers (the factory, the
            // scrapyard) *without* validating `toPartyId` — so persisting the client's value
            // here would store an id that references nothing and later be copied onto the
            // machine as its holder.
            toPartyId: receiver?.id ?? this.receiverPartyId(rule, dto),
            branchId: this.branchFor(rule, actor.user, receiver, machines),
            status: TransferStatus.PENDING,
            initiatedByUserId: actor.user.id,
            notes: dto.notes ?? null,
            clientUuid: dto.clientUuid,
            occurredAt: new Date(dto.occurredAt),
            createdBy: actor.user.id,
          }),
        );

        await this.insertItems(manager, transfer, dto.items, machines, actor.user.id);

        // The machines belong to nobody until somebody signs. Holder columns are deliberately left
        // pointing at the sender so a rejection has somewhere to roll back to.
        await manager.getRepository(Machine).update(
          { id: In(machines.map((machine) => machine.id)) },
          {
            status: MachineStatus.IN_TRANSIT,
            updatedBy: actor.user.id,
          },
        );

        // An auto-confirmed leg signs once, in `confirm`, against the final payload hash. Storing it
        // here too would file the same signature twice under two different hashes.
        const signatureNeeded =
          rule.autoConfirm || rule.signatures.includes(SignaturePartyRole.SENDER);

        if (signatureNeeded && !dto.senderSignature) {
          throw AppException.unprocessable(ErrorCode.SIGNATURE_REQUIRED);
        }

        if (!rule.autoConfirm && dto.senderSignature) {
          await this.storeSignature(
            manager,
            transfer,
            SignaturePartyRole.SENDER,
            dto.senderSignature,
            actor,
          );
        }

        return transfer.id;
      })
      .catch(async (error: unknown) => {
        // Two retries of the same request can both pass the replay check above; the loser hits
        // `uq_transfers_client_uuid`. That is still just a replay, not a failure.
        if (isUniqueViolation(error)) {
          const raced = await this.findReplay(dto.clientUuid, actor);
          if (raced) return raced.id;
        }
        throw error;
      });

    await this.audit.record({
      userId: actor.user.id,
      action: AuditAction.TRANSFER_CREATED,
      entityType: AuditEntityType.TRANSFER,
      entityId: id,
      after: { type: dto.type, itemCount: dto.items.length },
    });

    // A merchant has no account to sign with, so the sender's own signature closes the document.
    // Run as a second transaction so the created transfer is durable even if confirm trips.
    if (rule.autoConfirm) {
      return this.confirm(
        id,
        { signature: dto.senderSignature!, payloadHash: await this.currentPayloadHash(id) },
        actor,
        {
          selfAttested: true,
          // On the merchant-return leg the acting representative is the receiver, not the sender —
          // he is the one taking the machine back into custody.
          signatureRole: rule.signatures.includes(SignaturePartyRole.RECEIVER)
            ? SignaturePartyRole.RECEIVER
            : SignaturePartyRole.SENDER,
        },
      );
    }

    const created = await this.findById(id, { branchId: null, unrestricted: true }, actor.user);
    await this.notifyPending(created, actor.user);

    return created;
  }

  /**
   * The confirm flow. The receiver's corrections win over the sender's declaration — he is the one
   * taking custody, and the mismatch that produces is recorded as evidence rather than argued
   * about.
   */
  async confirm(
    id: string,
    dto: ConfirmTransferDto,
    actor: TransferActor,
    options: { selfAttested?: boolean; signatureRole?: SignaturePartyRole } = {},
  ): Promise<Transfer> {
    // Collected inside the transaction, notified after it: a rolled-back confirm must not leave a
    // representative with a notification about a violation that no longer exists.
    const detectedViolationIds: string[] = [];

    await this.dataSource.transaction(async (manager) => {
      const transfer = await this.lockTransfer(manager, id);
      const rule = TRANSFER_RULES[transfer.type];

      this.assertPending(transfer);

      if (!options.selfAttested) {
        this.assertIsReceiver(transfer, actor.user);
      }

      const items = await manager.getRepository(TransferItem).find({
        where: { transferId: transfer.id },
      });

      // Compare before applying adjustments: the hash covers what the receiver *read*, and his
      // corrections are what he is about to change it to.
      if (hashTransferPayload(items) !== dto.payloadHash) {
        throw AppException.conflict(ErrorCode.PAYLOAD_CHANGED);
      }

      const machines = await this.lockMachinesByIds(
        manager,
        items.map((item) => item.machineId),
      );
      const byId = new Map(machines.map((machine) => [machine.id, machine]));

      if (dto.adjustments?.length) {
        await this.applyAdjustments(manager, items, dto.adjustments, byId, actor.user.id);
      }

      // Re-derived after adjustments, because a corrected serial changes the verdict and the
      // pre-adjustment verdict is not what the receiver signed for.
      for (const item of items) {
        const machine = byId.get(item.machineId)!;
        Object.assign(item, this.matchSerials(item, machine));
        await manager.getRepository(TransferItem).update(item.id, {
          batteryMatches: item.batteryMatches,
          simMatches: item.simMatches,
          boxMatches: item.boxMatches,
        });
      }

      const signedAt = new Date();
      await this.storeSignature(
        manager,
        transfer,
        options.signatureRole ?? SignaturePartyRole.RECEIVER,
        dto.signature,
        actor,
        { payloadHash: hashTransferPayload(items), signedAt },
      );

      await this.applyCustody(manager, transfer, rule, items, byId, actor.user.id);

      // A mismatch on a return leg is written down, never used to refuse the machine: sending it
      // back out with the representative would leave the company with neither the unit nor a
      // record of what was wrong with it.
      if (rule.runViolationChecks) {
        const responsibleUserId = this.responsibleForReturn(transfer, actor.user);

        if (responsibleUserId) {
          const detected = await this.violations.detectFor(
            { transfer, items, responsibleUserId, actorId: actor.user.id },
            manager,
          );

          detectedViolationIds.push(...detected.map((violation) => violation.id));
        }
      }

      await manager.getRepository(Transfer).update(transfer.id, {
        status: TransferStatus.CONFIRMED,
        confirmedAt: signedAt,
        confirmedByUserId: actor.user.id,
        updatedBy: actor.user.id,
      });
    });

    const confirmed = await this.findById(id, { branchId: null, unrestricted: true }, actor.user);
    await this.notifyConfirmed(confirmed, actor.user);
    await this.violations.notifyCreated(detectedViolationIds, actor.user.id);

    await this.audit.record({
      userId: actor.user.id,
      action: AuditAction.TRANSFER_CONFIRMED,
      entityType: AuditEntityType.TRANSFER,
      entityId: id,
      before: { status: 'PENDING' },
      after: { status: 'CONFIRMED', confirmedBy: actor.user.id },
    });

    return confirmed;
  }

  /**
   * The whole delivery never physically happened. Every machine goes back to the status it had
   * before it left — which is read off the item rows, not recomputed, because "where it came from"
   * is not derivable from the transfer type alone.
   *
   * A single mismatched machine is *not* rejected: it is accepted and a violation is filed. The two
   * mechanisms stay distinct on purpose.
   */
  async reject(id: string, dto: RejectTransferDto, actor: TransferActor): Promise<Transfer> {
    await this.dataSource.transaction(async (manager) => {
      const transfer = await this.lockTransfer(manager, id);

      this.assertPending(transfer);
      this.assertIsReceiver(transfer, actor.user);

      await this.rollback(manager, transfer, actor.user.id);

      await manager.getRepository(Transfer).update(transfer.id, {
        status: TransferStatus.REJECTED,
        rejectionReason: dto.reason,
        updatedBy: actor.user.id,
      });
    });

    const rejected = await this.findById(id, { branchId: null, unrestricted: true }, actor.user);
    await this.notifyRejected(rejected, dto.reason, actor.user);

    await this.audit.record({
      userId: actor.user.id,
      action: AuditAction.TRANSFER_REJECTED,
      entityType: AuditEntityType.TRANSFER,
      entityId: id,
      before: { status: 'PENDING' },
      after: { status: 'REJECTED', reason: dto.reason },
    });

    return rejected;
  }

  /** The sender changes his mind, within the configured window, before anyone has signed. */
  async cancel(id: string, dto: CancelTransferDto, actor: TransferActor): Promise<Transfer> {
    await this.dataSource.transaction(async (manager) => {
      const transfer = await this.lockTransfer(manager, id);

      this.assertPending(transfer);

      if (transfer.initiatedByUserId !== actor.user.id) {
        throw AppException.forbidden(ErrorCode.NOT_THE_SENDER);
      }

      const windowMs = this.business.transferCancelWindowMinutes * 60 * 1000;
      if (Date.now() - transfer.createdAt.getTime() > windowMs) {
        throw AppException.unprocessable(ErrorCode.CANCEL_WINDOW_EXPIRED);
      }

      await this.rollback(manager, transfer, actor.user.id);

      await manager.getRepository(Transfer).update(transfer.id, {
        status: TransferStatus.CANCELLED,
        rejectionReason: dto.reason ?? null,
        updatedBy: actor.user.id,
      });
    });

    await this.audit.record({
      userId: actor.user.id,
      action: AuditAction.TRANSFER_CANCELLED,
      entityType: AuditEntityType.TRANSFER,
      entityId: id,
      before: { status: 'PENDING' },
      after: { status: 'CANCELLED', reason: dto.reason ?? null },
    });

    return this.findById(id, { branchId: null, unrestricted: true }, actor.user);
  }

  /** The hash the client must echo back when confirming. */
  /** Returns the caller's own earlier transfer for this idempotency key, if any. */
  private async findReplay(clientUuid: string, actor: TransferActor): Promise<Transfer | null> {
    const existing = await this.transfers.findOne({
      where: { clientUuid, initiatedByUserId: actor.user.id },
    });

    return existing
      ? this.findById(existing.id, { branchId: null, unrestricted: true }, actor.user)
      : null;
  }

  async currentPayloadHash(transferId: string, manager?: EntityManager): Promise<string> {
    const repository = manager ? manager.getRepository(TransferItem) : this.items;
    return hashTransferPayload(await repository.find({ where: { transferId } }));
  }

  // ── queries ────────────────────────────────────────────────────────────────

  private baseQuery(): SelectQueryBuilder<Transfer> {
    return this.transfers
      .createQueryBuilder('transfer')
      .leftJoinAndSelect('transfer.branch', 'branch')
      .leftJoinAndSelect('transfer.initiatedBy', 'initiator')
      .leftJoinAndSelect('transfer.confirmedBy', 'confirmer')
      .loadRelationCountAndMap('transfer.itemsCount', 'transfer.items');
  }

  /**
   * `18`: the receiver learns a hand-off is waiting for his signature.
   *
   * Silent when the receiving party has no account — a merchant, a warehouse, the factory. Those
   * legs are self-attested and there is nobody on the other end to tell.
   */
  private async notifyPending(transfer: Transfer, actor: AuthUser): Promise<void> {
    const receiver = await this.userParty(transfer.toPartyType, transfer.toPartyId);
    if (!receiver) return;

    await this.notifications.tryDispatch({
      templateCode: NotificationTemplateCode.TRANSFER_PENDING,
      recipients: [receiver],
      params: {
        referenceNo: transfer.referenceNo,
        senderName: actor.fullName,
        machineCount: transfer.items?.length ?? 0,
      },
      entityType: NotificationEntityType.TRANSFER,
      entityId: transfer.id,
      actorId: actor.id,
    });
  }

  /** `18`: the sender learns his delivery was signed for. */
  private async notifyConfirmed(transfer: Transfer, actor: AuthUser): Promise<void> {
    const sender = await this.recipients.byId(transfer.initiatedByUserId);
    if (!sender) return;

    await this.notifications.tryDispatch({
      templateCode: NotificationTemplateCode.TRANSFER_CONFIRMED,
      recipients: [sender],
      params: {
        referenceNo: transfer.referenceNo,
        receiverName: actor.fullName,
        machineCount: transfer.items?.length ?? 0,
      },
      entityType: NotificationEntityType.TRANSFER,
      entityId: transfer.id,
      actorId: actor.id,
    });
  }

  /** `18`: a refusal is the sender's problem and his supervisor's, so both hear about it. */
  private async notifyRejected(transfer: Transfer, reason: string, actor: AuthUser): Promise<void> {
    const sender = await this.recipients.byId(transfer.initiatedByUserId);
    const supervisors = await this.recipients.branchSupervisors(transfer.branchId);
    const audience = dedupeRecipients([...(sender ? [sender] : []), ...supervisors]);

    if (audience.length === 0) return;

    await this.notifications.tryDispatch({
      templateCode: NotificationTemplateCode.TRANSFER_REJECTED,
      recipients: audience,
      params: {
        referenceNo: transfer.referenceNo,
        receiverName: actor.fullName,
        reason,
      },
      entityType: NotificationEntityType.TRANSFER,
      entityId: transfer.id,
      actorId: actor.id,
    });
  }

  /** The party behind a transfer leg, when it is a person with an account rather than a place. */
  private userParty(partyType: PartyType, partyId: string | null): Promise<Recipient | null> {
    if (!partyId || !USER_PARTIES.includes(partyType)) return Promise.resolve(null);

    return this.recipients.byId(partyId);
  }

  private detailQuery(): SelectQueryBuilder<Transfer> {
    return this.transfers
      .createQueryBuilder('transfer')
      .leftJoinAndSelect('transfer.branch', 'branch')
      .leftJoinAndSelect('transfer.initiatedBy', 'initiator')
      .leftJoinAndSelect('transfer.confirmedBy', 'confirmer')
      .leftJoinAndSelect('transfer.items', 'item')
      .leftJoinAndSelect('item.machine', 'machine')
      .leftJoinAndSelect('machine.machineModel', 'model')
      .leftJoinAndSelect('item.photos', 'photo')
      .leftJoinAndSelect('photo.media', 'media')
      .leftJoinAndSelect('transfer.signatures', 'signature')
      .leftJoinAndSelect('signature.user', 'signer');
  }

  /**
   * A branch-scoped user sees their branch's traffic plus anything addressed to them personally —
   * a representative's transfers carry his branch, but a company-warehouse dispatch to him does
   * not yet, and hiding his own inbox would be absurd.
   */
  private applyScope(qb: SelectQueryBuilder<Transfer>, scope: BranchScope, actor: AuthUser): void {
    if (scope.unrestricted) return;

    qb.andWhere(
      '(transfer.branch_id = :scopeBranch OR transfer.to_party_id = :actorId OR transfer.initiated_by_user_id = :actorId)',
      { scopeBranch: scope.branchId, actorId: actor.id },
    );
  }

  private canSee(transfer: Transfer, scope: BranchScope, actor: AuthUser): boolean {
    if (scope.unrestricted) return true;

    return (
      transfer.branchId === scope.branchId ||
      transfer.toPartyId === actor.id ||
      transfer.initiatedByUserId === actor.id
    );
  }

  // ── create-path checks ─────────────────────────────────────────────────────

  /**
   * Resolves and validates the receiving side. Returns the receiving *user* when the party is an
   * account; warehouse, merchant and abstract receivers have no user to hand back.
   */
  private async resolveReceiver(
    manager: EntityManager,
    dto: CreateTransferDto,
    rule: TransferRule,
    actor: AuthUser,
  ): Promise<User | null> {
    if (ABSTRACT_PARTIES.includes(rule.to) || rule.toPartyOptional) {
      return null;
    }

    // On the merchant-return leg the receiver is the man making the request. Reading it from
    // the actor rather than the body is what makes it impossible to push custody onto a
    // colleague who never saw the machines and never signed for them.
    if (receiverIsCreator(rule)) {
      return manager.getRepository(User).findOneByOrFail({ id: actor.id });
    }

    if (!dto.toPartyId) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, {
        details: [{ field: 'toPartyId', constraint: `required for a ${rule.to} receiver` }],
      });
    }

    if (rule.to === PartyType.WAREHOUSE) {
      const warehouse = await manager
        .getRepository(Warehouse)
        .findOne({ where: { id: dto.toPartyId, isActive: true } });

      if (!warehouse) {
        throw new AppException(ErrorCode.VALIDATION_FAILED, {
          details: [{ field: 'toPartyId', value: dto.toPartyId, constraint: 'unknown warehouse' }],
        });
      }

      // "A warehouse" is not specific enough: routing a company return into another
      // branch's store is the branch-to-branch move the rules map exists to prevent, and
      // scrapping into a maintenance store would divorce status from location.
      if (rule.toWarehouseTypes && !rule.toWarehouseTypes.includes(warehouse.type)) {
        throw AppException.unprocessable(ErrorCode.WAREHOUSE_TYPE_CONFLICT, {
          expected: rule.toWarehouseTypes.join(' | '),
          actual: warehouse.type,
        });
      }

      return null;
    }

    if (rule.to === PartyType.MERCHANT) {
      // A merchant is a record, not an account, so there is no user to return — but the id still
      // has to name a live shop, or a machine would be signed over to nothing.
      if (!(await this.merchants.isDeliverable(dto.toPartyId, manager))) {
        throw new AppException(ErrorCode.VALIDATION_FAILED, {
          details: [{ field: 'toPartyId', value: dto.toPartyId, constraint: 'unknown merchant' }],
        });
      }

      return null;
    }

    if (!USER_PARTIES.includes(rule.to)) {
      return null;
    }

    const receiver = await manager.getRepository(User).findOne({
      where: { id: dto.toPartyId, isActive: true },
      relations: { role: true },
    });

    if (!receiver) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, {
        details: [{ field: 'toPartyId', value: dto.toPartyId, constraint: 'unknown user' }],
      });
    }

    if (partyForRole(receiver.role?.code ?? '') !== rule.to) {
      throw AppException.unprocessable(ErrorCode.INVALID_TRANSFER_TYPE);
    }

    return receiver;
  }

  /**
   * The caller must actually be the sending party. Holding `transfers.create` is not enough: a
   * representative cannot invent a company-warehouse dispatch, and a supervisor cannot hand a
   * machine to another branch's representative.
   */
  private assertSenderMayCreate(rule: TransferRule, actor: AuthUser, receiver: User | null): void {
    const actorParty = partyForRole(actor.roleCode);

    // When the sending side has no login — a merchant, the factory, a service centre — the
    // receiver books the hand-off in. He is the only person present who can.
    const expectedParty = UNREPRESENTED_PARTIES.includes(rule.from) ? rule.to : rule.from;

    if (actorParty !== expectedParty) {
      throw AppException.forbidden(ErrorCode.INVALID_TRANSFER_TYPE);
    }

    if (rule.sameBranchRequired) {
      const receiverBranch = receiver?.branchId ?? null;

      if (!actor.branchId || !receiverBranch || actor.branchId !== receiverBranch) {
        throw AppException.unprocessable(ErrorCode.INTER_BRANCH_DIRECT_TRANSFER_NOT_ALLOWED);
      }
    }

    // An auto-confirming leg closes on the actor's signature alone. If its receiver is an
    // account, that account must therefore be the actor — otherwise one representative
    // could push custody onto another who never signed and never saw the machines.
    if (rule.autoConfirm && receiver && receiver.id !== actor.id) {
      throw AppException.forbidden(ErrorCode.NOT_THE_RECEIVER);
    }
  }

  /**
   * `SELECT … FOR UPDATE` on every machine in the request. Two phones dispatching the same unit
   * serialize here, and the second one finds it already `IN_TRANSIT`.
   */
  private async lockMachines(
    manager: EntityManager,
    items: TransferItemDto[],
    lock: boolean,
  ): Promise<Machine[]> {
    const ids = items.map((item) => item.machineId);

    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    if (duplicates.length > 0) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, {
        details: [...new Set(duplicates)].map((id) => ({
          field: 'items',
          value: id,
          constraint: 'the same machine appears twice in this transfer',
        })),
      });
    }

    const machines = lock
      ? await this.lockMachinesByIds(manager, ids)
      : await manager
          .getRepository(Machine)
          .find({ where: { id: In(ids) }, relations: { battery: true } });

    const found = new Set(machines.map((machine) => machine.id));
    const missing = ids.filter((id) => !found.has(id));

    if (missing.length > 0) {
      throw AppException.notFound(ErrorCode.MACHINE_NOT_FOUND, { id: missing[0] });
    }

    return machines;
  }

  private lockMachinesByIds(manager: EntityManager, ids: string[]): Promise<Machine[]> {
    if (ids.length === 0) return Promise.resolve([]);

    return (
      manager
        .getRepository(Machine)
        .createQueryBuilder('machine')
        .leftJoinAndSelect('machine.battery', 'battery')
        .where('machine.id IN (:...ids)', { ids })
        // The join makes a plain `FOR UPDATE` try to lock `batteries` too, which is neither needed
        // nor safe to hold while another transaction reads a battery.
        .setLock('pessimistic_write', undefined, ['machine'])
        // Rows are locked in a consistent order across transactions. Two transfers sharing
        // two machines in opposite request order would otherwise each hold what the other
        // needs and deadlock.
        .orderBy('machine.id', 'ASC')
        .getMany()
    );
  }

  private async assertMachinesMovable(
    manager: EntityManager,
    dto: CreateTransferDto,
    rule: TransferRule,
    machines: Machine[],
    actor: AuthUser,
  ): Promise<void> {
    const pending = await this.pendingMachineIds(
      manager,
      machines.map((machine) => machine.id),
    );

    for (const machine of machines) {
      if (TERMINAL_MACHINE_STATUSES.includes(machine.status)) {
        throw AppException.unprocessable(ErrorCode.MACHINE_RETIRED, { serial: machine.serial });
      }

      if (pending.has(machine.id)) {
        throw AppException.conflict(ErrorCode.MACHINE_ALREADY_IN_TRANSIT, {
          serial: machine.serial,
        });
      }

      // Factory intake is the one leg with no prior custody to check — the machine is arriving
      // into the system for the first time, or coming back from a repair the system never saw.
      //
      // "No prior custody" has to actually be true, though. An empty `allowedFromStatuses`
      // read as "any status" would make intake a way to teleport a machine out of anyone's
      // hands: a unit sitting with a representative could be re-booked into the warehouse
      // without him signing anything.
      if (rule.allowedFromStatuses.length === 0) {
        if (machine.currentHolderType !== null || machine.currentHolderId !== null) {
          throw AppException.unprocessable(ErrorCode.INVALID_MACHINE_STATUS, {
            serial: machine.serial,
            status: machine.status,
          });
        }
      }

      if (rule.allowedFromStatuses.length > 0) {
        if (!rule.allowedFromStatuses.includes(machine.status)) {
          throw AppException.unprocessable(ErrorCode.INVALID_MACHINE_STATUS, {
            serial: machine.serial,
            status: machine.status,
          });
        }

        this.assertInSenderCustody(rule, machine, actor);
      }
    }

    void dto;
  }

  /**
   * "Is this actually yours to send?" A representative may only dispatch what the system says he
   * holds, and a supervisor only what sits in his branch. Warehouse-side senders are checked by
   * status alone, because the company warehouse is a place rather than a person.
   */
  private assertInSenderCustody(rule: TransferRule, machine: Machine, actor: AuthUser): void {
    // A merchant does not log in, so there is no account to match — but the machine must
    // genuinely be at a merchant. Which merchant, and whether this actor may deal with
    // them, is checked in `resolveReturningMerchant`.
    if (rule.from === PartyType.MERCHANT) {
      if (machine.currentHolderType !== PartyType.MERCHANT || !machine.currentHolderId) {
        throw AppException.unprocessable(ErrorCode.NOT_IN_YOUR_CUSTODY, {
          serial: machine.serial,
        });
      }
      return;
    }

    if (!USER_PARTIES.includes(rule.from)) return;

    const holdsIt = machine.currentHolderType === rule.from && machine.currentHolderId === actor.id;

    const inMyBranch =
      rule.from === PartyType.SUPERVISOR &&
      actor.branchId !== null &&
      machine.currentBranchId === actor.branchId;

    if (!holdsIt && !inMyBranch) {
      throw AppException.unprocessable(ErrorCode.NOT_IN_YOUR_CUSTODY, { serial: machine.serial });
    }
  }

  /**
   * Machines already spoken for by another pending transfer. The partial unique index in the
   * migration is the real guarantee; this exists so the caller gets a serial rather than a
   * constraint name.
   */
  private async pendingMachineIds(manager: EntityManager, ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();

    const rows = await manager
      .getRepository(TransferItem)
      .createQueryBuilder('item')
      .innerJoin('item.transfer', 'transfer')
      .where('item.machine_id IN (:...ids)', { ids })
      .andWhere('transfer.status = :pending', { pending: TransferStatus.PENDING })
      .select('item.machine_id', 'machineId')
      .getRawMany<{ machineId: string }>();

    return new Set(rows.map((row) => row.machineId));
  }

  // ── writes ─────────────────────────────────────────────────────────────────

  private async insertItems(
    manager: EntityManager,
    transfer: Transfer,
    dtos: TransferItemDto[],
    machines: Machine[],
    actorId: string,
  ): Promise<void> {
    const byId = new Map(machines.map((machine) => [machine.id, machine]));
    const repo = manager.getRepository(TransferItem);

    for (const dto of dtos) {
      const machine = byId.get(dto.machineId)!;

      const item = await repo.save(
        repo.create({
          transferId: transfer.id,
          machineId: machine.id,
          batterySerialScanned: dto.batterySerialScanned ?? null,
          simSerialScanned: dto.simSerialScanned ?? null,
          boxSerialScanned: dto.boxSerialScanned ?? null,
          hasCharger: dto.hasCharger,
          hasBox: dto.hasBox,
          condition: dto.condition,
          previousStatus: machine.status,
          notes: dto.notes ?? null,
          createdBy: actorId,
          ...this.matchSerials(dto, machine),
        }),
      );

      await this.attachPhotos(manager, item, dto.photoMediaIds ?? [], actorId);
    }
  }

  private async attachPhotos(
    manager: EntityManager,
    item: TransferItem,
    mediaIds: string[],
    actorId: string,
  ): Promise<void> {
    if (mediaIds.length === 0) return;

    if (mediaIds.length > this.business.maxPhotosPerTransferItem) {
      throw AppException.unprocessable(ErrorCode.TOO_MANY_PHOTOS, {
        max: this.business.maxPhotosPerTransferItem,
      });
    }

    const media = await this.media.claim(mediaIds, MediaPurpose.TRANSFER_PHOTO, manager, actorId);
    const repo = manager.getRepository(TransferItemPhoto);

    await repo.save(
      media.map((row) =>
        repo.create({ transferItemId: item.id, mediaId: row.id, createdBy: actorId }),
      ),
    );
  }

  /**
   * Tri-state on purpose: `null` when the serial was never scanned. "The rep did not scan the SIM"
   * and "the SIM is not the one we shipped" are different facts, and only the second one is a
   * violation.
   */
  private matchSerials(
    scanned: {
      batterySerialScanned?: string | null;
      simSerialScanned?: string | null;
      boxSerialScanned?: string | null;
    },
    machine: Machine,
  ): { batteryMatches: boolean | null; simMatches: boolean | null; boxMatches: boolean | null } {
    return {
      batteryMatches: compare(scanned.batterySerialScanned, machine.battery?.serial ?? null),
      simMatches: compare(scanned.simSerialScanned, machine.simSerial),
      boxMatches: compare(scanned.boxSerialScanned, machine.boxSerial),
    };
  }

  /** The receiver's word wins: he is the one who now has to answer for what he holds. */
  private async applyAdjustments(
    manager: EntityManager,
    items: TransferItem[],
    adjustments: ItemAdjustmentDto[],
    machines: Map<string, Machine>,
    actorId: string,
  ): Promise<void> {
    const byId = new Map(items.map((item) => [item.id, item]));

    for (const adjustment of adjustments) {
      const item = byId.get(adjustment.transferItemId);

      if (!item) {
        throw new AppException(ErrorCode.VALIDATION_FAILED, {
          details: [
            {
              field: 'adjustments',
              value: adjustment.transferItemId,
              constraint: 'not an item of this transfer',
            },
          ],
        });
      }

      if (adjustment.hasCharger !== undefined) item.hasCharger = adjustment.hasCharger;
      if (adjustment.hasBox !== undefined) item.hasBox = adjustment.hasBox;
      if (adjustment.condition !== undefined) item.condition = adjustment.condition;
      if (adjustment.notes !== undefined) item.notes = adjustment.notes;
      if (adjustment.batterySerialScanned !== undefined) {
        item.batterySerialScanned = adjustment.batterySerialScanned;
      }
      if (adjustment.simSerialScanned !== undefined) {
        item.simSerialScanned = adjustment.simSerialScanned;
      }
      if (adjustment.boxSerialScanned !== undefined) {
        item.boxSerialScanned = adjustment.boxSerialScanned;
      }

      Object.assign(item, this.matchSerials(item, machines.get(item.machineId)!));

      await manager.getRepository(TransferItem).update(item.id, {
        hasCharger: item.hasCharger,
        hasBox: item.hasBox,
        condition: item.condition,
        notes: item.notes,
        batterySerialScanned: item.batterySerialScanned,
        simSerialScanned: item.simSerialScanned,
        boxSerialScanned: item.boxSerialScanned,
        batteryMatches: item.batteryMatches,
        simMatches: item.simMatches,
        boxMatches: item.boxMatches,
        updatedBy: actorId,
      });
    }
  }

  /** The one place in the system that moves custody. */
  private async applyCustody(
    manager: EntityManager,
    transfer: Transfer,
    rule: TransferRule,
    items: TransferItem[],
    machines: Map<string, Machine>,
    actorId: string,
  ): Promise<void> {
    const holder = await this.resolveHolder(manager, transfer, rule);
    const repo = manager.getRepository(Machine);

    for (const item of items) {
      const machine = machines.get(item.machineId)!;

      await repo.update(machine.id, {
        status: rule.resultStatus,
        currentHolderType: rule.to,
        currentHolderId: transfer.toPartyId,
        currentBranchId: holder.branchId,
        currentWarehouseId: holder.warehouseId,
        // Whether the carton travelled with it is a fact about right now, and the receiver just
        // told us. `boxSerial` — which carton it is — is untouched.
        hasBox: item.hasBox,
        decommissionedAt:
          rule.resultStatus === MachineStatus.DECOMMISSIONED
            ? new Date()
            : machine.decommissionedAt,
        updatedBy: actorId,
      });
    }
  }

  /** Where the machines physically end up, which is not always where the receiver is filed. */
  private async resolveHolder(
    manager: EntityManager,
    transfer: Transfer,
    rule: TransferRule,
  ): Promise<{ branchId: string | null; warehouseId: string | null }> {
    if (rule.to === PartyType.WAREHOUSE && transfer.toPartyId) {
      const warehouse = await manager
        .getRepository(Warehouse)
        .findOne({ where: { id: transfer.toPartyId } });

      return { branchId: warehouse?.branchId ?? null, warehouseId: warehouse?.id ?? null };
    }

    if (USER_PARTIES.includes(rule.to) && transfer.toPartyId) {
      const receiver = await manager
        .getRepository(User)
        .findOne({ where: { id: transfer.toPartyId } });

      return { branchId: receiver?.branchId ?? null, warehouseId: null };
    }

    // A machine with a merchant, at the factory or in a service centre still belongs to the branch
    // that sent it out — that is who has to get it back.
    return { branchId: transfer.branchId, warehouseId: null };
  }

  /** Restores every machine to the status recorded on its item row when the transfer was created. */
  private async rollback(
    manager: EntityManager,
    transfer: Transfer,
    actorId: string,
  ): Promise<void> {
    const items = await manager
      .getRepository(TransferItem)
      .find({ where: { transferId: transfer.id } });

    await this.lockMachinesByIds(
      manager,
      items.map((item) => item.machineId),
    );

    for (const item of items) {
      await manager
        .getRepository(Machine)
        .update(item.machineId, { status: item.previousStatus, updatedBy: actorId });
    }
  }

  private async storeSignature(
    manager: EntityManager,
    transfer: Transfer,
    role: SignaturePartyRole,
    dto: SignatureDto,
    actor: TransferActor,
    options: { payloadHash?: string; signedAt?: Date } = {},
  ): Promise<void> {
    if (dto.method === SignatureMethod.DRAWN_SIGNATURE && dto.signatureMediaId) {
      await this.media.claim(
        [dto.signatureMediaId],
        MediaPurpose.SIGNATURE,
        manager,
        actor.user.id,
      );
    }

    if (dto.method === SignatureMethod.BIOMETRIC && !dto.deviceId) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, {
        details: [{ field: 'signature.deviceId', constraint: 'required for biometric signatures' }],
      });
    }

    const repo = manager.getRepository(TransferSignature);
    const signedAt = options.signedAt ?? new Date();

    const signature = await repo.save(
      repo.create({
        transferId: transfer.id,
        userId: actor.user.id,
        partyRole: role,
        method: dto.method,
        signatureMediaId: dto.signatureMediaId ?? null,
        biometricVerifiedAt: dto.method === SignatureMethod.BIOMETRIC ? signedAt : null,
        deviceId: dto.deviceId ?? null,
        deviceModel: dto.deviceModel ?? null,
        ipAddress: actor.ipAddress,
        signedAt,
        // Read through the caller's manager: when this runs inside the creating
        // transaction the items are not yet visible on another connection, and the
        // fallback would silently hash an empty list — storing a signature that is
        // evidence for no payload at all.
        payloadHash: options.payloadHash ?? (await this.currentPayloadHash(transfer.id, manager)),
      }),
    );

    await this.audit.record({
      userId: actor.user.id,
      action: AuditAction.TRANSFER_SIGNATURE_CAPTURED,
      entityType: AuditEntityType.TRANSFER_SIGNATURE,
      entityId: signature.id,
      after: { transferId: transfer.id, partyRole: role, method: dto.method },
    });
  }

  // ── small helpers ──────────────────────────────────────────────────────────

  private async lockTransfer(manager: EntityManager, id: string): Promise<Transfer> {
    const transfer = await manager
      .getRepository(Transfer)
      .createQueryBuilder('transfer')
      .where('transfer.id = :id', { id })
      .setLock('pessimistic_write')
      .getOne();

    if (!transfer) throw AppException.notFound(ErrorCode.TRANSFER_NOT_FOUND);

    return transfer;
  }

  private assertPending(transfer: Transfer): void {
    if (transfer.status !== TransferStatus.PENDING) {
      throw AppException.unprocessable(ErrorCode.TRANSFER_NOT_PENDING);
    }
  }

  private assertIsReceiver(transfer: Transfer, actor: AuthUser): void {
    if (transfer.toPartyId && transfer.toPartyId !== actor.id) {
      // A warehouse receiver has no single owner: anyone with the permission books it in, which
      // is how the company warehouse actually works — whoever is on shift signs.
      if (transfer.toPartyType !== PartyType.WAREHOUSE) {
        throw AppException.forbidden(ErrorCode.NOT_THE_RECEIVER);
      }
    }
  }

  private senderPartyId(rule: TransferRule, actor: AuthUser): string | null {
    return USER_PARTIES.includes(rule.from) ? actor.id : null;
  }

  /**
   * The receiving id worth storing. Only kept for receivers `resolveReceiver` actually
   * verified — a warehouse or a merchant. For the factory and the scrapyard there is no
   * entity to point at, so anything the client sent is discarded rather than persisted.
   */
  private receiverPartyId(rule: TransferRule, dto: CreateTransferDto): string | null {
    if (ABSTRACT_PARTIES.includes(rule.to) || rule.toPartyOptional) return null;

    return dto.toPartyId ?? null;
  }

  /**
   * The merchant a return is coming from, taken from the machines' current custody rather
   * than from the client.
   *
   * Two things depend on it. The merchant's timeline joins on `from_party_id`, so leaving it
   * null makes every return invisible and a shop appears to receive machines and never give
   * them back. And the actor must be allowed to deal with that merchant — without the check,
   * any representative could "return" a machine placed by a colleague in another branch.
   */
  private async resolveReturningMerchant(
    manager: EntityManager,
    rule: TransferRule,
    machines: Machine[],
    actor: TransferActor,
  ): Promise<string | null> {
    if (rule.from !== PartyType.MERCHANT) return null;

    const merchantIds = [...new Set(machines.map((machine) => machine.currentHolderId))];

    // One document, one counterparty: a single signature cannot attest to hand-offs from
    // two different shops.
    if (merchantIds.length !== 1 || !merchantIds[0]) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, {
        details: [
          { field: 'items', constraint: 'all machines must be returning from the same merchant' },
        ],
      });
    }

    const merchantId = merchantIds[0];
    if (!(await this.merchants.isDeliverable(merchantId, manager, actor.user))) {
      throw AppException.forbidden(ErrorCode.NOT_IN_YOUR_CUSTODY);
    }

    return merchantId;
  }

  /**
   * Who answers for what came back.
   *
   * Normally the sender: a representative returning to his branch, a supervisor returning to the
   * company. On the merchant leg there is no sending account at all — the merchant does not log
   * in — and the representative booking the machine back in is the same man who placed it there,
   * so he is the one the comparison is against.
   */
  private responsibleForReturn(transfer: Transfer, actor: AuthUser): string | null {
    if (transfer.fromPartyType === PartyType.MERCHANT) return actor.id;

    return transfer.fromPartyId ?? transfer.initiatedByUserId;
  }

  /**
   * Which branch the transfer belongs to for scoping and reporting. Preference order: the receiver
   * (that is where it is going), then the sender, then whatever branch the machines came from.
   */
  private branchFor(
    rule: TransferRule,
    actor: AuthUser,
    receiver: User | null,
    machines: Machine[],
  ): string | null {
    if (receiver?.branchId) return receiver.branchId;
    if (USER_PARTIES.includes(rule.from) && actor.branchId) return actor.branchId;

    return machines.find((machine) => machine.currentBranchId)?.currentBranchId ?? null;
  }
}

/** `null` in, `null` out — an unscanned serial makes no claim either way. */
function compare(scanned: string | null | undefined, expected: string | null): boolean | null {
  if (scanned === undefined || scanned === null || scanned === '') return null;

  return scanned.trim().toLowerCase() === (expected ?? '').trim().toLowerCase();
}

/** Postgres `unique_violation`. */
function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === '23505';
}
