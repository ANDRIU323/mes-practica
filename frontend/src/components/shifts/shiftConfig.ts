import type { Shift, ShiftStatus, ShiftType } from '../../types/shift';

export const SHIFT_TYPE_LABEL: Record<ShiftType, string> = {
  MORNING: 'Mañana',
  AFTERNOON: 'Tarde',
  NIGHT: 'Noche',
};

export const SHIFT_STATUS_CONFIG: Record<ShiftStatus, { label: string; color: string }> = {
  UPCOMING: { label: 'Próximo', color: 'gray' },
  ACTIVE: { label: 'En curso', color: 'blue' },
  ENDED: { label: 'Sin cerrar', color: 'yellow' },
  CLOSED: { label: 'Cerrado', color: 'teal' },
};

const HOUR_MS = 3_600_000;

// Las horas se pintan en la zona de la planta, no en la del navegador: un admin
// que mire desde otro país debe ver "06:00" en el turno de mañana
export function formatPlantTime(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat('es-ES', { timeZone, hour: '2-digit', minute: '2-digit' }).format(
    new Date(iso),
  );
}

export function formatPlantDateTime(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

// Duración real: 7, 8 o 9 h según si esa noche cambia la hora
export function shiftDurationHours(shift: Pick<Shift, 'startsAt' | 'endsAt'>) {
  return (new Date(shift.endsAt).getTime() - new Date(shift.startsAt).getTime()) / HOUR_MS;
}

export function shiftTimeRange(shift: Shift, timeZone: string) {
  return `${formatPlantTime(shift.startsAt, timeZone)}–${formatPlantTime(shift.endsAt, timeZone)}`;
}
