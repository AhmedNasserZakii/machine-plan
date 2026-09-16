import { z } from 'zod';

export const violationFormSchema = z.object({
  violationTypeId: z.string().min(1),
  userId: z.string().min(1),
  machineId: z
    .string()
    .optional()
    .transform((v) => {
      if (!v) return undefined;
      const t = v.trim();
      return t.length ? t : undefined;
    }),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  description: z.string().trim().min(5).max(1000),
});

export type ViolationFormValues = z.infer<typeof violationFormSchema>;

export const violationFormDefaults: ViolationFormValues = {
  violationTypeId: '',
  userId: '',
  machineId: undefined,
  severity: 'MEDIUM',
  description: '',
};

export const violationEditSchema = z.object({
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  description: z.string().trim().min(5).max(1000),
});

export type ViolationEditValues = z.infer<typeof violationEditSchema>;

export const chargeViolationSchema = z.object({
  amount: z.number().min(0.01),
  paymentMethodId: z.string().uuid(),
  notes: z
    .string()
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      const t = v.trim();
      return t.length ? t : undefined;
    }),
});

export type ChargeViolationFormValues = z.infer<typeof chargeViolationSchema>;

export const waiveViolationSchema = z.object({
  reason: z.string().trim().min(5).max(500),
});

export type WaiveViolationFormValues = z.infer<typeof waiveViolationSchema>;
