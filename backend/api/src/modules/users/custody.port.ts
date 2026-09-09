import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PartyType } from 'src/common/enums/transfer.enum';
import { Machine } from 'src/modules/machines/entities/machine.entity';
import { Merchant } from 'src/modules/merchants/entities/merchant.entity';
import { Brackets, Repository } from 'typeorm';

export const CUSTODY_PORT = Symbol('CUSTODY_PORT');

/**
 * Read-only view of what a user currently holds.
 *
 * Users depend on this to enforce "a user cannot be deactivated while holding machines",
 * but machines only exist from Phase 3 onwards. `NullCustodyAdapter` keeps the rule wired
 * and testable until the machines module provides the real implementation.
 */
export interface CustodyPort {
  countHeldByUser(userId: string): Promise<number>;
}

/**
 * Counts both machines physically held by the user and machines that representative placed with
 * one of their merchants. The latter are still part of that representative's accountable
 * portfolio, as reflected by the custody response in plan `05`.
 */
@Injectable()
export class MachineCustodyAdapter implements CustodyPort {
  constructor(
    @InjectRepository(Machine)
    private readonly machines: Repository<Machine>,
  ) {}

  countHeldByUser(userId: string): Promise<number> {
    return this.machines
      .createQueryBuilder('machine')
      .leftJoin(
        Merchant,
        'merchant',
        `machine.current_holder_type = :merchantType
         AND merchant.id = machine.current_holder_id
         AND merchant.deleted_at IS NULL`,
        { merchantType: PartyType.MERCHANT },
      )
      .where(
        new Brackets((where) =>
          where
            .where(
              `machine.current_holder_type IN (:...userPartyTypes)
               AND machine.current_holder_id = :userId`,
              {
                userPartyTypes: [PartyType.SUPERVISOR, PartyType.REPRESENTATIVE],
                userId,
              },
            )
            .orWhere('merchant.created_by_user_id = :userId', { userId }),
        ),
      )
      .getCount();
  }
}
