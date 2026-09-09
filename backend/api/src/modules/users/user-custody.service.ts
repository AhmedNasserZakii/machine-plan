import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DEFAULT_LOCALE, Locale } from 'src/common/constants/locales';
import { MachineStatus } from 'src/common/enums/machine-status.enum';
import { PartyType } from 'src/common/enums/transfer.enum';
import { ViolationStatus } from 'src/common/enums/operations.enum';
import { UserCustodyResponse } from './dto/responses/user-custody.response';
import { UsersService } from './users.service';

interface CustodyRow {
  id: string;
  serial: string;
  model_name: string;
  status: MachineStatus;
  merchant_id: string | null;
  merchant_shop_name: string | null;
  held_since: Date | string;
}

@Injectable()
export class UserCustodyService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly users: UsersService,
  ) {}

  async findForUser(
    userId: string,
    branchScope: string | null,
    locale: Locale,
  ): Promise<UserCustodyResponse> {
    const user = await this.users.findById(userId, branchScope);

    const rows = await this.dataSource.query<CustodyRow[]>(
      `SELECT machine.id,
              machine.serial,
              COALESCE(requested_model.name, fallback_model.name, model.code) AS model_name,
              machine.status,
              merchant.id AS merchant_id,
              merchant.shop_name AS merchant_shop_name,
              COALESCE(
                (SELECT MAX(COALESCE(transfer.confirmed_at, transfer.occurred_at))
                   FROM transfer_items item
                   JOIN transfers transfer ON transfer.id = item.transfer_id
                  WHERE item.machine_id = machine.id
                    AND item.deleted_at IS NULL
                    AND transfer.deleted_at IS NULL
                    AND transfer.status = 'CONFIRMED'
                    AND transfer.to_party_type = machine.current_holder_type
                    AND transfer.to_party_id = machine.current_holder_id),
                machine.created_at
              ) AS held_since
         FROM machines machine
         JOIN machine_models model ON model.id = machine.machine_model_id
         LEFT JOIN machine_model_translations requested_model
           ON requested_model.machine_model_id = model.id AND requested_model.locale = $2
         LEFT JOIN machine_model_translations fallback_model
           ON fallback_model.machine_model_id = model.id AND fallback_model.locale = $3
         LEFT JOIN merchants merchant
           ON machine.current_holder_type = $4
          AND merchant.id = machine.current_holder_id
          AND merchant.deleted_at IS NULL
        WHERE machine.deleted_at IS NULL
          AND (
            (machine.current_holder_type IN ($5, $6) AND machine.current_holder_id = $1)
            OR merchant.created_by_user_id = $1
          )
        ORDER BY held_since ASC, machine.serial ASC`,
      [
        userId,
        locale,
        DEFAULT_LOCALE,
        PartyType.MERCHANT,
        PartyType.SUPERVISOR,
        PartyType.REPRESENTATIVE,
      ],
    );

    const openViolationRows = await this.dataSource.query<Array<{ count: string }>>(
      `SELECT COUNT(*)::text AS count
         FROM violations
        WHERE user_id = $1
          AND status IN ($2, $3)
          AND deleted_at IS NULL`,
      [userId, ViolationStatus.OPEN, ViolationStatus.ACKNOWLEDGED],
    );

    const machines = rows.map((row) => ({
      id: row.id,
      serial: row.serial,
      model: row.model_name,
      status: row.status,
      merchant:
        row.merchant_id && row.merchant_shop_name
          ? { id: row.merchant_id, shopName: row.merchant_shop_name }
          : null,
      heldSince: new Date(row.held_since).toISOString(),
    }));
    const withMerchants = machines.filter((machine) => machine.merchant !== null).length;

    return {
      user: { id: user.id, fullName: user.fullName, role: user.role.code },
      summary: {
        totalMachines: machines.length,
        withMerchants,
        inHand: machines.length - withMerchants,
        openViolations: Number(openViolationRows[0]?.count ?? 0),
      },
      machines,
    };
  }
}
