import { CustomDecorator, SetMetadata } from '@nestjs/common';

export const AUDIT_FINANCE_READ_KEY = 'auditFinanceRead';

/**
 * Marks a finance-data read endpoint so the global `AuditInterceptor` records one
 * `FINANCE_READ_ACCESSED` row per hit — no payload, just who looked and when (`21`: "reading
 * finance data is logged at a summary level because access to money data is itself sensitive").
 */
export const AuditFinanceRead = (): CustomDecorator<string> =>
  SetMetadata(AUDIT_FINANCE_READ_KEY, true);
