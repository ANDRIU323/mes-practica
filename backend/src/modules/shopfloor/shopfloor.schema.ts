import { z } from 'zod';

export const workLogIdParams = z.object({
  id: z.coerce.number().int().positive(),
});

export const stopReason = z.enum(['END_OF_SHIFT', 'BREAK', 'MACHINE_ISSUE', 'LINE_CHANGE']);

// La nota es obligatoria solo en una incidencia de máquina (también hay un CHECK en la BD)
export const stopWorkLogBody = z
  .object({
    producedQty: z.number().int().min(0),
    stopReason,
    note: z.string().trim().max(500).optional(),
  })
  .refine((body) => body.stopReason !== 'MACHINE_ISSUE' || !!body.note, {
    message: 'Describe la incidencia de la máquina',
    path: ['note'],
  });

export type StopWorkLogBody = z.infer<typeof stopWorkLogBody>;
