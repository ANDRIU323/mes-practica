import type { ShiftType } from '@prisma/client';

// Zona horaria de la planta: los turnos se definen en su hora local, no en UTC
export const PLANT_TIME_ZONE = process.env.PLANT_TIME_ZONE ?? 'Europe/Madrid';

// Hora local de inicio y fin de cada turno; un fin <= inicio significa "del día siguiente"
export const SHIFT_HOURS: Record<ShiftType, { start: number; end: number }> = {
  MORNING: { start: 6, end: 14 },
  AFTERNOON: { start: 14, end: 22 },
  NIGHT: { start: 22, end: 6 },
};

const SHIFT_ORDER: ShiftType[] = ['MORNING', 'AFTERNOON', 'NIGHT'];

// Día local en formato "YYYY-MM-DD"
export type LocalDay = string;

interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

// Fecha y hora que marca el reloj de la zona en ese instante
function localParts(instant: Date, timeZone: string): LocalParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(instant).map((p) => [p.type, Number(p.value)]),
  );
  return parts as unknown as LocalParts;
}

// Cuánto va la zona por delante de UTC en ese instante (en Madrid, 1 h en invierno y 2 h en verano)
function offsetMs(instant: Date, timeZone: string) {
  const p = localParts(instant, timeZone);
  const localAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return localAsUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

// La hora que marca el reloj local, guardada como si fuera UTC. Sirve para formatos sin
// zona (Excel): exceljs escribe la hora UTC del Date, así que se verá la hora local
export function toLocalWallClock(instant: Date, timeZone = PLANT_TIME_ZONE) {
  return new Date(instant.getTime() + offsetMs(instant, timeZone));
}

// Instante UTC en que el reloj local marca `hour`:00 de `day` (+ `addDays`).
// Primero se resta el desfase de la hora "como si fuera UTC"; si con eso se cruza un
// cambio de hora, el desfase bueno es el del resultado, así que se repite una vez.
// Las horas de turno (6, 14, 22) y la medianoche nunca caen en la hora que se salta o se repite (2–3 h).
export function localTimeToUtc(day: LocalDay, hour: number, timeZone = PLANT_TIME_ZONE, addDays = 0) {
  const [y, m, d] = day.split('-').map(Number);
  const naive = Date.UTC(y, m - 1, d + addDays, hour);
  const firstGuess = naive - offsetMs(new Date(naive), timeZone);
  return new Date(naive - offsetMs(new Date(firstGuess), timeZone));
}

// Suma días a un día local sin pasar por ninguna zona (aritmética de calendario)
export function addDays(day: LocalDay, days: number): LocalDay {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// Inicio y fin en UTC del turno `type` que empieza el día local `day`
export function shiftWindow(day: LocalDay, type: ShiftType, timeZone = PLANT_TIME_ZONE) {
  const { start, end } = SHIFT_HOURS[type];
  return {
    startsAt: localTimeToUtc(day, start, timeZone),
    endsAt: localTimeToUtc(day, end, timeZone, end <= start ? 1 : 0),
  };
}

// Turno en curso en ese instante. Antes de las 6:00 aún es el de noche del día anterior
export function shiftAt(instant: Date, timeZone = PLANT_TIME_ZONE): { date: LocalDay; type: ShiftType } {
  const p = localParts(instant, timeZone);
  const today = `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
  if (p.hour < SHIFT_HOURS.MORNING.start) return { date: addDays(today, -1), type: 'NIGHT' };
  if (p.hour < SHIFT_HOURS.AFTERNOON.start) return { date: today, type: 'MORNING' };
  if (p.hour < SHIFT_HOURS.NIGHT.start) return { date: today, type: 'AFTERNOON' };
  return { date: today, type: 'NIGHT' };
}

// Todos los turnos que empiezan entre `from` y `to` (días locales incluidos), en orden
export function shiftsBetween(from: LocalDay, to: LocalDay, timeZone = PLANT_TIME_ZONE) {
  const shifts: { date: LocalDay; type: ShiftType; startsAt: Date; endsAt: Date }[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    for (const type of SHIFT_ORDER) shifts.push({ date: day, type, ...shiftWindow(day, type, timeZone) });
  }
  return shifts;
}
