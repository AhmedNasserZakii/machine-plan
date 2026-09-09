import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MachineStatus } from 'src/common/enums/machine-status.enum';
import { ViolationStatus } from 'src/common/enums/operations.enum';
import { Machine } from 'src/modules/machines/entities/machine.entity';
import { Violation } from 'src/modules/violations/entities/violation.entity';
import {
  BranchFinanceStats,
  BranchMachineStats,
  BranchStatsPort,
  NullBranchStatsAdapter,
} from '../branch-stats.port';

interface StatusCountRow {
  status: MachineStatus;
  count: string;
}

/**
 * Fills in the machine and violation halves of `BranchStatsPort`. Finance is still delegated to
 * the null adapter until Phase 7 lands, so that number stays visibly unimplemented rather than
 * becoming a hand-written stub that looks real.
 *
 * It lives in the organization module, next to its only consumer, and reaches for the `Machine`
 * and `Violation` repositories directly: importing either module here would close a cycle, since
 * both resolve their branch against this module's entities.
 */
@Injectable()
export class MachineBranchStatsAdapter implements BranchStatsPort {
  private readonly notYetImplemented = new NullBranchStatsAdapter();

  constructor(
    @InjectRepository(Machine) private readonly machines: Repository<Machine>,
    @InjectRepository(Violation) private readonly violations: Repository<Violation>,
  ) {}

  /**
   * "Open" means unresolved, which is both `OPEN` and `ACKNOWLEDGED`: acknowledging a violation
   * records that the offender has seen it, not that anyone has charged or waived it. Counting
   * only `OPEN` would let a branch bury its backlog by acknowledging everything.
   */
  countOpenViolations(branchId: string): Promise<number> {
    return this.violations
      .createQueryBuilder('violation')
      .where('violation.branch_id = :branchId', { branchId })
      .andWhere('violation.status IN (:...unresolved)', {
        unresolved: [ViolationStatus.OPEN, ViolationStatus.ACKNOWLEDGED],
      })
      .getCount();
  }

  monthFinance(): Promise<BranchFinanceStats> {
    return this.notYetImplemented.monthFinance();
  }

  /**
   * Counts every machine still on the books, including decommissioned ones. Branch deactivation
   * gates on this, and a retired machine is still a row pointing at the branch.
   */
  countMachines(branchId: string): Promise<number> {
    return this.machines.count({ where: { currentBranchId: branchId } });
  }

  async machineStats(branchId: string): Promise<BranchMachineStats> {
    const rows = await this.machines
      .createQueryBuilder('machine')
      .select('machine.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('machine.current_branch_id = :branchId', { branchId })
      .groupBy('machine.status')
      .getRawMany<StatusCountRow>();

    // Statuses with no machines are omitted rather than sent as zeros: the dashboard renders one
    // chip per key, and eleven chips of which nine say "0" is noise.
    const byStatus: Partial<Record<MachineStatus, number>> = {};
    let total = 0;

    for (const row of rows) {
      const count = Number(row.count);
      byStatus[row.status] = count;
      total += count;
    }

    return { total, byStatus };
  }
}
