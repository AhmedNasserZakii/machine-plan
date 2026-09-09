import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Locale } from 'src/common/constants/locales';
import { LookupEntity } from 'src/common/entities/lookup.entity';
import { AuthUser, BranchScope } from 'src/common/types/request.types';
import { joinTranslation } from 'src/common/utils';
import { categoryName } from 'src/modules/finance/category-tree';
import { FinanceCategory } from 'src/modules/finance/entities/finance-category.entity';
import { DecommissionReason } from 'src/modules/lookups/entities/decommission-reason.entity';
import { MachineModel } from 'src/modules/lookups/entities/machine-model.entity';
import { MachineType } from 'src/modules/lookups/entities/machine-type.entity';
import { MaintenanceLocation } from 'src/modules/lookups/entities/maintenance-location.entity';
import { PaymentMethod } from 'src/modules/lookups/entities/payment-method.entity';
import { ViolationType } from 'src/modules/lookups/entities/violation-type.entity';
import {
  toLookupResponse,
  toMachineModelResponse,
  toMachineTypeResponse,
  toViolationTypeResponse,
} from 'src/modules/lookups/mappers/lookup.mapper';
import { MachinesService } from 'src/modules/machines/machines.service';
import { toMachineListItemResponse } from 'src/modules/machines/mappers/machine.mapper';
import { MerchantsService } from 'src/modules/merchants/merchants.service';
import { toMerchantListItemResponse } from 'src/modules/merchants/mappers/merchant.mapper';
import { Branch } from 'src/modules/organization/entities/branch.entity';
import { toBranchResponse } from 'src/modules/organization/mappers/branch.mapper';
import { WarehouseType } from 'src/common/enums/operations.enum';
import { Perm, PermissionCode } from 'src/modules/roles/permissions.catalogue';
import { toTransferResponse } from 'src/modules/transfers/mappers/transfer.mapper';
import { TransfersService } from 'src/modules/transfers/transfers.service';
import {
  SyncBootstrapResponse,
  SyncDeltaResponse,
  SyncFinanceCategoryResponse,
  SyncLookupsResponse,
  SyncStatusResponse,
} from './dto/responses/sync.response';
import { SYNC_SCHEMA_VERSION } from './sync-schema-version';

/**
 * The read half of offline support (`20`, sync endpoints).
 *
 * Bootstrap and delta answer with the same shape from the same queries — the only difference is
 * an `updated_at > since` predicate — so the client cannot end up with a delta that reports a
 * field bootstrap never gave it.
 *
 * Both are deliberately unpaginated. They are scoped instead: a device is told about the
 * machines its user is holding and the merchants he may see, not about the fleet.
 */
@Injectable()
export class SyncService {
  constructor(
    @InjectRepository(MachineType) private readonly machineTypes: Repository<MachineType>,
    @InjectRepository(MachineModel) private readonly machineModels: Repository<MachineModel>,
    @InjectRepository(PaymentMethod) private readonly paymentMethods: Repository<PaymentMethod>,
    @InjectRepository(ViolationType) private readonly violationTypes: Repository<ViolationType>,
    @InjectRepository(MaintenanceLocation)
    private readonly maintenanceLocations: Repository<MaintenanceLocation>,
    @InjectRepository(DecommissionReason)
    private readonly decommissionReasons: Repository<DecommissionReason>,
    @InjectRepository(FinanceCategory)
    private readonly financeCategories: Repository<FinanceCategory>,
    @InjectRepository(Branch) private readonly branches: Repository<Branch>,
    private readonly machines: MachinesService,
    private readonly merchants: MerchantsService,
    private readonly transfers: TransfersService,
  ) {}

  status(): SyncStatusResponse {
    return { serverTime: new Date().toISOString(), schemaVersion: SYNC_SCHEMA_VERSION };
  }

  async bootstrap(user: AuthUser, locale: Locale): Promise<SyncBootstrapResponse> {
    return this.collect(user, locale, null);
  }

  /**
   * `nextSince` is read before the queries run, not after: a row written while they were running
   * would otherwise fall in the gap between the cursor the client is handed and the data it got.
   * Handing back a slightly early cursor costs one row being sent twice, which the `clientUuid`
   * and `id` the client already holds make harmless.
   */
  async delta(since: Date, user: AuthUser, locale: Locale): Promise<SyncDeltaResponse> {
    const nextSince = new Date();
    const changed = await this.collect(user, locale, since);

    return {
      ...changed,
      deleted: {
        machines: user.permissions.includes(Perm.MACHINES_READ)
          ? await this.machines.releasedFromCustody(user.id, since)
          : [],
        merchants: this.canReadMerchants(user)
          ? await this.merchants.closedSince(
              this.scopeFor(user, Perm.MERCHANTS_READ_ALL),
              user,
              since,
            )
          : [],
        transfers: user.permissions.includes(Perm.TRANSFERS_READ)
          ? await this.transfers.settledSince(user, since)
          : [],
      },
      nextSince: nextSince.toISOString(),
    };
  }

  private async collect(
    user: AuthUser,
    locale: Locale,
    since: Date | null,
  ): Promise<SyncBootstrapResponse> {
    const [lookups, myMachines, myMerchants, pendingTransfers] = await Promise.all([
      this.lookups(user, locale, since),
      user.permissions.includes(Perm.MACHINES_READ)
        ? this.machines.inCustodyOf(user.id, locale, since ?? undefined)
        : [],
      this.canReadMerchants(user)
        ? this.merchants.visibleForSync(
            this.scopeFor(user, Perm.MERCHANTS_READ_ALL),
            user,
            since ?? undefined,
          )
        : [],
      user.permissions.includes(Perm.TRANSFERS_READ)
        ? this.transfers.pendingForSignature(user)
        : [],
    ]);

    return {
      serverTime: new Date().toISOString(),
      schemaVersion: SYNC_SCHEMA_VERSION,
      lookups,
      myMachines: myMachines.map((machine) => toMachineListItemResponse(machine, locale)),
      myMerchants: myMerchants.map((row) =>
        toMerchantListItemResponse(row.merchant, row.machinesCount),
      ),
      // Not filtered by `since`: an unsigned transfer is a job still to do, and a device that
      // syncs after its cursor has moved past the day the transfer was created would otherwise
      // never be told about it.
      pendingTransfers: pendingTransfers.map((transfer) => toTransferResponse(transfer, locale)),
      permissions: user.permissions,
    };
  }

  private async lookups(
    user: AuthUser,
    locale: Locale,
    since: Date | null,
  ): Promise<SyncLookupsResponse> {
    // Payment methods and the category tree are money, gated exactly as their own endpoints are.
    // A representative gets empty arrays rather than a 403 that would fail his whole sync.
    const seesFinance = user.permissions.includes(Perm.FINANCE_READ);

    const [
      machineTypes,
      machineModels,
      paymentMethods,
      violationTypes,
      maintenanceLocations,
      decommissionReasons,
      financeCategories,
      branches,
    ] = await Promise.all([
      this.lookupRows(this.machineTypes, 'type', locale, since),
      this.lookupRows(this.machineModels, 'model', locale, since, (qb) => {
        qb.leftJoinAndSelect('model.machineType', 'modelType');
        joinTranslation(qb, 'modelType', 'translations', locale);
      }),
      seesFinance ? this.lookupRows(this.paymentMethods, 'method', locale, since) : [],
      this.lookupRows(this.violationTypes, 'violationType', locale, since),
      this.lookupRows(this.maintenanceLocations, 'location', locale, since),
      this.lookupRows(this.decommissionReasons, 'reason', locale, since),
      seesFinance ? this.categories(locale, since) : [],
      this.branchRows(since),
    ]);

    return {
      machineTypes: machineTypes.map((row) => toMachineTypeResponse(row, locale)),
      machineModels: machineModels.map((row) => toMachineModelResponse(row, locale)),
      paymentMethods: paymentMethods.map((row) => toLookupResponse(row, locale)),
      violationTypes: violationTypes.map((row) => toViolationTypeResponse(row, locale)),
      maintenanceLocations: maintenanceLocations.map((row) => toLookupResponse(row, locale)),
      decommissionReasons: decommissionReasons.map((row) => toLookupResponse(row, locale)),
      financeCategories,
      branches: branches.map((branch) => toBranchResponse(branch)),
    };
  }

  /**
   * Inactive rows are included on purpose: a machine bought years ago still points at a retired
   * model, and a device that dropped the row would render the machine with no model name at all.
   * `isActive` travels with each row so the client can keep them out of its pickers.
   */
  private lookupRows<T extends LookupEntity>(
    repository: Repository<T>,
    alias: string,
    locale: Locale,
    since: Date | null,
    join?: (qb: SelectQueryBuilder<T>) => void,
  ): Promise<T[]> {
    const qb = repository.createQueryBuilder(alias);

    joinTranslation(qb, alias, 'translations', locale);
    join?.(qb);

    if (since) {
      qb.andWhere(`${alias}.updated_at > :since`, { since });
    }

    return qb.orderBy(`${alias}.sort_order`, 'ASC').addOrderBy(`${alias}.code`, 'ASC').getMany();
  }

  private async categories(
    locale: Locale,
    since: Date | null,
  ): Promise<SyncFinanceCategoryResponse[]> {
    const qb = this.financeCategories.createQueryBuilder('category');

    joinTranslation(qb, 'category', 'translations', locale);

    if (since) {
      qb.andWhere('category.updated_at > :since', { since });
    }

    const rows = await qb.orderBy('category.path', 'ASC').getMany();

    return rows.map((category) => ({
      id: category.id,
      code: category.code,
      name: categoryName(category, locale),
      kind: category.kind,
      parentId: category.parentId,
      isActive: category.isActive,
      sortOrder: category.sortOrder,
    }));
  }

  private branchRows(since: Date | null): Promise<Branch[]> {
    const qb = this.branches
      .createQueryBuilder('branch')
      .leftJoinAndSelect('branch.warehouses', 'warehouse', 'warehouse.type = :branchType', {
        branchType: WarehouseType.BRANCH,
      });

    if (since) {
      qb.andWhere('branch.updated_at > :since', { since });
    }

    return qb.orderBy('branch.name', 'ASC').getMany();
  }

  private canReadMerchants(user: AuthUser): boolean {
    if (!user.permissions.includes(Perm.MERCHANTS_READ)) return false;

    // Without the `.all` variant the list is pinned to the caller's branch, and a company-level
    // user has no branch to pin it to — the same reason `BranchScopeGuard` refuses that pairing.
    return user.permissions.includes(Perm.MERCHANTS_READ_ALL) || user.branchId !== null;
  }

  private scopeFor(user: AuthUser, readAll: PermissionCode): BranchScope {
    return user.permissions.includes(readAll)
      ? { branchId: null, unrestricted: true }
      : { branchId: user.branchId, unrestricted: false };
  }
}
