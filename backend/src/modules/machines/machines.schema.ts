import { z } from 'zod';

export const machineStatus = z.enum(['ACTIVE', 'MAINTENANCE', 'INACTIVE']);
export type MachineStatus = z.infer<typeof machineStatus>;

// Textos para los mensajes de error que ve el usuario
export const MACHINE_STATUS_LABELS: Record<MachineStatus, string> = {
  ACTIVE: 'Activa',
  MAINTENANCE: 'Mantenimiento',
  INACTIVE: 'Inactiva',
};

export const machineIdParams = z.object({
  id: z.coerce.number().int().positive(),
});

export const createMachineBody = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  status: machineStatus.optional(),
});

// En la edición todos los campos son opcionales
export const updateMachineBody = createMachineBody.partial();

export type CreateMachineBody = z.infer<typeof createMachineBody>;
export type UpdateMachineBody = z.infer<typeof updateMachineBody>;
