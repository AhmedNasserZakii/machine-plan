import { MachineStatus } from 'src/common/enums/machine-status.enum';

export const BRANCH_STATS_PORT = Symbol('BRANCH_STATS_PORT');

export interface BranchMachineStats {
  total: number;
  byStatus: Partial<Record<MachineStatus, number>>;
}

export interface BranchFinanceStats {
  monthExpenses: number;
  monthIncome: number;
}

/**
 * Everything `GET /branches/:id/summary` needs from modules that do not exist yet.
 *
 * Branches ship in Phase 2, but machines land in Phase 3, violations in Phase 5 and finance in
 * Phase 7. This port lets the summary endpoint and its permission gating be built and tested
 * now; each later phase replaces one method with a real query instead of reworking the
 * controller. `countMachines` is also what enforces "a branch cannot be deactivated while it
 * holds machines", so that rule is wired from the start rather than retrofitted.
 */
export interface BranchStatsPort {
  countMachines(branchId: string): Promise<number>;
  machineStats(branchId: string): Promise<BranchMachineStats>;
  countOpenViolations(branchId: string): Promise<number>;
  monthFinance(branchId: string): Promise<BranchFinanceStats>;
}

/** Reports an empty fleet, so the rules behave correctly against a database with no machines. */
export class NullBranchStatsAdapter implements BranchStatsPort {
  countMachines(): Promise<number> {
    return Promise.resolve(0);
  }

  machineStats(): Promise<BranchMachineStats> {
    return Promise.resolve({ total: 0, byStatus: {} });
  }

  countOpenViolations(): Promise<number> {
    return Promise.resolve(0);
  }

  monthFinance(): Promise<BranchFinanceStats> {
    return Promise.resolve({ monthExpenses: 0, monthIncome: 0 });
  }
}
