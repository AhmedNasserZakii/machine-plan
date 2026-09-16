import { z } from 'zod';

export const transactionFormSchema = z.object({
  kind: z.enum(['EXPENSE', 'INCOME']),
  amount: z.number().positive(),
  categoryId: z.string().uuid(),
  transactionDate: z.string().min(1),
  paymentMethodId: z.string().uuid(),
  branchId: z.string().uuid().optional().or(z.literal('')),
  supplierId: z.string().uuid().optional().or(z.literal('')),
  notes: z.string().max(2000).optional().or(z.literal('')),
});

export type TransactionFormValues = z.infer<typeof transactionFormSchema>;

export const transactionFormDefaults: TransactionFormValues = {
  kind: 'EXPENSE',
  amount: undefined as unknown as number,
  categoryId: '',
  transactionDate: '',
  paymentMethodId: '',
  branchId: '',
  supplierId: '',
  notes: '',
};

export const budgetFormSchema = z
  .object({
    categoryId: z.string().uuid(),
    branchId: z.string().uuid().optional().or(z.literal('')),
    periodType: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM']),
    periodStart: z.string().min(1),
    periodEnd: z.string().min(1),
    amount: z.number().positive(),
    alertThresholdPercent: z.number().min(1).max(100).default(80),
    includeSubcategories: z.boolean().default(true),
    autoRenew: z.boolean().default(false),
  })
  .refine((v) => v.periodEnd >= v.periodStart, {
    message: 'periodEnd',
    path: ['periodEnd'],
  });

export type BudgetFormValues = z.infer<typeof budgetFormSchema>;

export const budgetFormDefaults: BudgetFormValues = {
  categoryId: '',
  branchId: '',
  periodType: 'MONTHLY',
  periodStart: '',
  periodEnd: '',
  amount: undefined as unknown as number,
  alertThresholdPercent: 80,
  includeSubcategories: true,
  autoRenew: false,
};

export const categoryFormSchema = z.object({
  kind: z.enum(['EXPENSE', 'INCOME']),
  parentId: z.string().uuid().optional().or(z.literal('')),
  nameAr: z.string().min(1),
  nameEn: z.string().optional().or(z.literal('')),
  descriptionAr: z.string().optional().or(z.literal('')),
  descriptionEn: z.string().optional().or(z.literal('')),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export type CategoryFormValues = z.infer<typeof categoryFormSchema>;
