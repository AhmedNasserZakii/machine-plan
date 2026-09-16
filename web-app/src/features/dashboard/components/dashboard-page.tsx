'use client';

import { BudgetAlertsTile } from './budget-alerts-tile';
import { DecommissionCandidatesTile } from './decommission-candidates-tile';
import { FinanceSummaryTile } from './finance-summary-tile';
import { GreetingTile } from './greeting-tile';
import { IdleMachinesTile } from './idle-machines-tile';
import { MachinesByStatusTile } from './machines-by-status-tile';
import { MyCustodyTile } from './my-custody-tile';
import { OpenMaintenanceTile } from './open-maintenance-tile';
import { OpenViolationsTile } from './open-violations-tile';
import {
  PendingIncomingTile,
  PendingOutgoingTile,
} from './pending-transfers-tile';
import { RecentActivityTile } from './recent-activity-tile';
import { WarrantyExpiringTile } from './warranty-expiring-tile';

export function DashboardPage() {
  return (
    <div className="mx-auto max-w-[var(--content-max-width)] space-y-lg">
      <GreetingTile />

      {/* Action required */}
      <div className="grid gap-md lg:grid-cols-2">
        <PendingIncomingTile />
        <PendingOutgoingTile />
      </div>

      {/* Alerts */}
      <div className="grid gap-md lg:grid-cols-2">
        <BudgetAlertsTile />
        <WarrantyExpiringTile />
        <IdleMachinesTile />
        <DecommissionCandidatesTile />
        <OpenMaintenanceTile />
        <OpenViolationsTile />
      </div>

      {/* Overview */}
      <div className="grid gap-md lg:grid-cols-2">
        <MachinesByStatusTile />
        <MyCustodyTile />
        <FinanceSummaryTile />
      </div>

      {/* Recent activity */}
      <RecentActivityTile />
    </div>
  );
}
