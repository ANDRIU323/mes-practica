import { z } from 'zod';

export const loginBody = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(1).max(200),
});

export type LoginBody = z.infer<typeof loginBody>;

export const pinSchema = z.string().regex(/^\d{4}$/, 'El PIN son 4 dígitos');

export const employeeLoginBody = z.object({
  code: z.string().trim().toUpperCase().min(1).max(50),
  pin: pinSchema,
});

export type EmployeeLoginBody = z.infer<typeof employeeLoginBody>;

export const changePasswordBody = z
  .object({
    currentPassword: z.string().min(1).max(200),
    newPassword: z.string().min(8, 'Mínimo 8 caracteres').max(200),
  })
  .refine((body) => body.newPassword !== body.currentPassword, {
    message: 'La contraseña nueva debe ser distinta de la actual',
    path: ['newPassword'],
  });

export type ChangePasswordBody = z.infer<typeof changePasswordBody>;

// Campos del usuario que se pueden enviar al cliente (nunca passwordHash)
export const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
} as const;
