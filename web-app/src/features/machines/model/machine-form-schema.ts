import { z } from 'zod';

const optionalTrimmed = z
  .string()
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined;
    const t = v.trim();
    return t.length ? t : undefined;
  });

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Shared create/edit schema. `requiresSim` is injected from the selected type so
 * the SIM field is required when true and rejected when false.
 */
export function createMachineFormSchema(requiresSim: boolean) {
  return z
    .object({
      serial: z.string().trim().min(1),
      batterySerial: z.string().trim().min(1),
      simSerial: optionalTrimmed,
      boxSerial: optionalTrimmed,
      machineTypeId: z.string().min(1),
      machineModelId: z.string().min(1),
      purchasePrice: z.number().positive().optional(),
      purchaseDate: optionalTrimmed,
      factoryInvoiceNo: optionalTrimmed,
      warrantyStart: optionalTrimmed,
      warrantyEnd: optionalTrimmed,
      hasBox: z.boolean().default(false),
      notes: optionalTrimmed,
    })
    .superRefine((values, ctx) => {
      if (requiresSim) {
        if (!values.simSerial) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['simSerial'],
            message: 'required',
          });
        }
      } else if (values.simSerial) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['simSerial'],
          message: 'notApplicable',
        });
      }

      if (values.purchaseDate && values.purchaseDate > todayIso()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['purchaseDate'],
          message: 'future',
        });
      }

      if (
        values.warrantyStart &&
        values.warrantyEnd &&
        values.warrantyEnd <= values.warrantyStart
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['warrantyEnd'],
          message: 'afterStart',
        });
      }
    });
}

export type MachineFormValues = z.infer<ReturnType<typeof createMachineFormSchema>>;

export const machineFormDefaults: MachineFormValues = {
  serial: '',
  batterySerial: '',
  simSerial: undefined,
  boxSerial: undefined,
  machineTypeId: '',
  machineModelId: '',
  purchasePrice: undefined,
  purchaseDate: undefined,
  factoryInvoiceNo: undefined,
  warrantyStart: undefined,
  warrantyEnd: undefined,
  hasBox: false,
  notes: undefined,
};
