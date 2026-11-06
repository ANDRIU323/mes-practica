import { z } from 'zod';
import { addDays } from './shifts.time.js';

export const SHIFTS_MAX_DAYS = 31;

// Día local "YYYY-MM-DD" que existe en el calendario (rechaza "2026-02-30"). Sin hora
// ni zona: es un día de calendario de la planta, no un instante
export const localDay = z.string().date('Fecha no válida (YYYY-MM-DD)');

export const shiftType = z.enum(['MORNING', 'AFTERNOON', 'NIGHT']);

// Días incluidos los dos; se comparan como texto porque el formato es fijo. Sin ninguno
// de los dos, el día del turno actual. Zod ejecuta los refine del objeto aunque un campo
// sea inválido: addDays solo con uno bueno
export const listShiftsQuery = z
  .object({ from: localDay.optional(), to: localDay.optional() })
  .refine((q) => !q.from === !q.to, { message: '"from" y "to" van juntos', path: ['to'] })
  .refine((q) => !q.from || !q.to || q.from <= q.to, {
    message: '"from" no puede ser posterior a "to"',
    path: ['to'],
  })
  .refine(
    (q) =>
      !q.from || !q.to || !localDay.safeParse(q.from).success || q.to <= addDays(q.from, SHIFTS_MAX_DAYS - 1),
    { message: `Como mucho ${SHIFTS_MAX_DAYS} días`, path: ['to'] },
  );

export const shiftParams = z.object({ date: localDay, type: shiftType });

// force: cerrar aunque queden WorkLog abiertos (tras ver el aviso)
export const closeShiftBody = z.object({ force: z.boolean().default(false) });

export type ListShiftsQuery = z.infer<typeof listShiftsQuery>;
export type ShiftParams = z.infer<typeof shiftParams>;
