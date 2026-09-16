import { z } from 'zod';

const optionalTrimmed = z
  .string()
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined;
    const t = v.trim();
    return t.length ? t : undefined;
  });

export const createMaintenanceSchema = z.object({
  machineId: z.string().min(1),
  locationId: z.string().min(1),
  reportedFault: z.string().trim().min(1),
  sentAt: z.string().trim().min(1),
  notes: optionalTrimmed,
});

export type CreateMaintenanceValues = z.infer<typeof createMaintenanceSchema>;

export const closeOrderSchema = z
  .object({
    result: z.enum(['REPAIRED', 'REPLACED', 'UNREPAIRABLE']),
    isFreeUnderWarranty: z.boolean(),
    cost: z.number().nonnegative().optional(),
    responsibleParty: z.enum(['COMPANY', 'REPRESENTATIVE', 'MERCHANT', 'FACTORY']),
    responsibleUserId: optionalTrimmed,
    responsibleMerchantId: optionalTrimmed,
    paymentMethodId: optionalTrimmed,
    performedByName: optionalTrimmed,
    returnedAt: z.string().trim().min(1),
    notes: optionalTrimmed,
    // Replacement payload when result is REPLACED
    newSerial: optionalTrimmed,
    newBatterySerial: optionalTrimmed,
    newSimSerial: optionalTrimmed,
    newBoxSerial: optionalTrimmed,
    hasBox: z.boolean().default(false),
    replaceReason: optionalTrimmed,
    replacedAt: optionalTrimmed,
  })
  .superRefine((values, ctx) => {
    if (!values.isFreeUnderWarranty && (values.cost === undefined || values.cost < 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['cost'], message: 'required' });
    }
    if (values.responsibleParty === 'REPRESENTATIVE' && !values.responsibleUserId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['responsibleUserId'],
        message: 'required',
      });
    }
    if (values.responsibleParty === 'MERCHANT' && !values.responsibleMerchantId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['responsibleMerchantId'],
        message: 'required',
      });
    }
    if (
      values.responsibleParty === 'COMPANY' &&
      !values.isFreeUnderWarranty &&
      !values.paymentMethodId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['paymentMethodId'],
        message: 'required',
      });
    }
    if (values.result === 'REPLACED') {
      if (!values.newSerial) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['newSerial'], message: 'required' });
      }
      if (!values.newBatterySerial) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['newBatterySerial'],
          message: 'required',
        });
      }
      if (!values.replaceReason) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['replaceReason'],
          message: 'required',
        });
      }
    }
  });

export type CloseOrderValues = z.infer<typeof closeOrderSchema>;

export const replaceMachineSchema = z.object({
  newSerial: z.string().trim().min(1),
  newBatterySerial: z.string().trim().min(1),
  newSimSerial: optionalTrimmed,
  newBoxSerial: optionalTrimmed,
  hasBox: z.boolean().default(false),
  reason: z.string().trim().min(1),
  replacedAt: z.string().trim().min(1),
});

export type ReplaceMachineValues = z.infer<typeof replaceMachineSchema>;

export const decommissionSchema = z.object({
  reasonId: z.string().min(1),
  notes: z.string().trim().min(1),
  decommissionedAt: z.string().trim().min(1),
});

export type DecommissionValues = z.infer<typeof decommissionSchema>;
