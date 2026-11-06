import type { DashboardOee, DashboardStats } from './dashboard';

export type ShiftType = 'MORNING' | 'AFTERNOON' | 'NIGHT';

// UPCOMING → ACTIVE → ENDED (terminado sin cerrar) → CLOSED
export type ShiftStatus = 'UPCOMING' | 'ACTIVE' | 'ENDED' | 'CLOSED';

// Día local de la planta ("YYYY-MM-DD") + tipo: identifican un turno
export interface ShiftKey {
  date: string;
  type: ShiftType;
}

// startsAt/endsAt son instantes ISO (UTC): se pintan en la zona de la planta
export interface Shift extends ShiftKey {
  startsAt: string;
  endsAt: string;
  status: ShiftStatus;
  closedAt: string | null;
  closedBy: { id: number; name: string } | null;
}

// GET /shifts
export interface ShiftList {
  timeZone: string;
  from: string;
  to: string;
  current: ShiftKey;
  shifts: Shift[];
}

export interface OpenWorkLog {
  id: number;
  startedAt: string;
  employee: { id: number; code: string; name: string };
  order: { id: number; code: string };
  machine: { id: number; code: string; name: string } | null;
}

// GET /shifts/:date/:type
export interface ShiftReport {
  shift: Shift;
  openWorkLogs: OpenWorkLog[];
  stats: Omit<DashboardStats, 'from' | 'to'>;
  oee: Omit<DashboardOee, 'from' | 'to'>;
}

// POST /shifts/:date/:type/close (200). Con 409, { message, openWorkLogs }
export interface CloseShiftResult {
  shift: Shift;
  openWorkLogs: OpenWorkLog[];
}
