import { z } from 'zod';

export const userFormSchema = z.object({
  fullName: z.string().trim().min(1),
  phone: z.string().trim().min(8),
  email: z.string().trim().email().optional().or(z.literal('')),
  roleId: z.string().min(1),
  branchId: z.string().optional().or(z.literal('')),
  password: z.string().min(8).optional().or(z.literal('')),
});

export type UserFormValues = z.infer<typeof userFormSchema>;
