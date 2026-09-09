import { registerAs } from '@nestjs/config';

/** Tunable business rules that the Director may want changed without a code release. */
export interface BusinessConfig {
  financeBackdateLimitDays: number;
  /**
   * How long a manual finance transaction stays editable (`15`, rule 6). Past it the row may
   * only be voided, so a correction leaves a trail instead of quietly rewriting the ledger.
   */
  financeEditWindowDays: number;
  transferCancelWindowMinutes: number;
  maxPhotosPerTransferItem: number;
  /**
   * How long a representative may hold a machine before returning it counts as late (`10`).
   * Also what the idle-fleet sweep reads.
   */
  idleAlertDays: number;
}

export const businessConfig = registerAs('business', (): BusinessConfig => ({
  financeBackdateLimitDays: Number(process.env.FINANCE_BACKDATE_LIMIT_DAYS ?? 90),
  financeEditWindowDays: Number(process.env.FINANCE_EDIT_WINDOW_DAYS ?? 30),
  transferCancelWindowMinutes: Number(process.env.TRANSFER_CANCEL_WINDOW_MINUTES ?? 60),
  maxPhotosPerTransferItem: 4,
  idleAlertDays: Number(process.env.IDLE_ALERT_DAYS ?? 30),
}));
