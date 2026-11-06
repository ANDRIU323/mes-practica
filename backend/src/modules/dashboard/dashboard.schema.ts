import { z } from 'zod';
import { localDay } from '../shifts/shifts.schema.js';
import { localTimeToUtc, PLANT_TIME_ZONE } from '../shifts/shifts.time.js';

export const incidentsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

// Días locales de la planta (los dos incluidos) → [from, to) en UTC, de medianoche a
// medianoche en PLANT_TIME_ZONE. Así el rango no depende de la zona del navegador
export const statsQuery = z
  .object({ from: localDay, to: localDay })
  .refine((q) => q.from <= q.to, {
    message: '"from" no puede ser posterior a "to"',
    path: ['to'],
  })
  .transform((q) => ({
    from: localTimeToUtc(q.from, 0),
    to: localTimeToUtc(q.to, 0, PLANT_TIME_ZONE, 1),
  }));

export type IncidentsQuery = z.infer<typeof incidentsQuery>;
export type StatsQuery = z.infer<typeof statsQuery>;
