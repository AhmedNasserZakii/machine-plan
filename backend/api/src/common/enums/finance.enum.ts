export enum FinanceKind {
  EXPENSE = 'EXPENSE',
  INCOME = 'INCOME',
}

export const FINANCE_KINDS = Object.values(FinanceKind);

export enum TransactionSource {
  MANUAL = 'MANUAL',
  AUTO_MAINTENANCE = 'AUTO_MAINTENANCE',
  AUTO_VIOLATION = 'AUTO_VIOLATION',
  AUTO_SUBSCRIPTION = 'AUTO_SUBSCRIPTION',
}

export const TRANSACTION_SOURCES = Object.values(TransactionSource);

/** Auto-posted transactions are immutable — only the originating record may void them. */
export const AUTO_TRANSACTION_SOURCES: readonly TransactionSource[] = [
  TransactionSource.AUTO_MAINTENANCE,
  TransactionSource.AUTO_VIOLATION,
  TransactionSource.AUTO_SUBSCRIPTION,
];

export enum BudgetPeriodType {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
  CUSTOM = 'CUSTOM',
}

export const BUDGET_PERIOD_TYPES = Object.values(BudgetPeriodType);

export enum SubscriptionPlanType {
  NONE = 'NONE',
  ONE_TIME_FEE = 'ONE_TIME_FEE',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
}

export const SUBSCRIPTION_PLAN_TYPES = Object.values(SubscriptionPlanType);
