import { z } from 'zod';
import { pinSchema } from '../auth/auth.schema.js';

export const employeeIdParams = z.object({
  id: z.coerce.number().int().positive(),
});

export const createEmployeeBody = z.object({
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(100),
  active: z.boolean().optional(),
});

// En la edición todos los campos son opcionales
export const updateEmployeeBody = createEmployeeBody.partial();

export const setPinBody = z.object({ pin: pinSchema });

export type CreateEmployeeBody = z.infer<typeof createEmployeeBody>;
export type UpdateEmployeeBody = z.infer<typeof updateEmployeeBody>;
