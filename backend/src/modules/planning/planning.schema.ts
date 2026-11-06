import { z } from 'zod';

// Nueva cola completa de la máquina, de la primera a la última
export const sequenceBody = z.object({
  orderIds: z
    .array(z.number().int().positive())
    .max(500)
    .refine((ids) => new Set(ids).size === ids.length, { message: 'Hay órdenes repetidas' }),
});

export type SequenceBody = z.infer<typeof sequenceBody>;
