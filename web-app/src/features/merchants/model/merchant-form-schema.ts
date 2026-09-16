import { z } from 'zod';

const optionalTrimmed = z
  .string()
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined;
    const t = v.trim();
    return t.length ? t : undefined;
  });

const egyptianPhone = z
  .string()
  .trim()
  .regex(/^01[0125][0-9]{8}$/, 'phone');

const nationalId = optionalTrimmed.refine(
  (v) => v === undefined || /^\d{14}$/.test(v),
  { message: 'nationalId' },
);

export const merchantFormSchema = z.object({
  name: z.string().trim().min(1),
  phone: egyptianPhone,
  shopName: z.string().trim().min(1),
  address: z.string().trim().min(1),
  nationalId,
  notes: optionalTrimmed,
});

export type MerchantFormValues = z.infer<typeof merchantFormSchema>;

export const merchantFormDefaults: MerchantFormValues = {
  name: '',
  phone: '',
  shopName: '',
  address: '',
  nationalId: undefined,
  notes: undefined,
};

export const createSubscriptionSchema = z.object({
  planType: z.enum(['NONE', 'ONE_TIME_FEE', 'WEEKLY', 'MONTHLY']),
  amount: z.number().positive(),
  startDate: z.string().trim().min(1),
  endDate: optionalTrimmed,
  machineId: optionalTrimmed,
  notes: optionalTrimmed,
});

export type CreateSubscriptionValues = z.infer<typeof createSubscriptionSchema>;

export const collectSubscriptionSchema = z.object({
  amount: z.number().positive(),
  collectedAt: z.string().trim().min(1),
  paymentMethodId: z.string().min(1),
  notes: optionalTrimmed,
});

export type CollectSubscriptionValues = z.infer<typeof collectSubscriptionSchema>;
