import type { MachineStatus } from './machine';
import type { StopReason } from './worklog';

interface EmployeeRef {
  id: number;
  code: string;
  name: string;
}

interface MachineRef {
  id: number;
  code: string;
  name: string;
}

// GET /dashboard/live
export interface LiveWorkLog {
  id: number;
  startedAt: string;
  employee: EmployeeRef;
  order: { id: number; code: string; product: string };
  machine: MachineRef | null;
}

// GET /dashboard/incidents
export interface Incident {
  id: number;
  endedAt: string;
  note: string;
  employee: EmployeeRef;
  order: { id: number; code: string };
  // Estado actual: permite reactivarla desde la tarjeta
  machine: (MachineRef & { status: MachineStatus }) | null;
}

interface Totals {
  hours: number;
  units: number;
}

// Proporciones de 0 a 1; null = sin datos para calcularla (p. ej. órdenes sin ciclo ideal)
export interface OeeResult {
  runHours: number;
  unplannedStopHours: number;
  availability: number | null;
  performance: number | null;
  quality: number | null;
  oee: number | null;
}

// GET /dashboard/oee – máquinas de peor a mejor OEE
export interface DashboardOee {
  from: string;
  to: string;
  total: OeeResult;
  machines: (OeeResult & { machine: MachineRef })[];
}

// GET /dashboard/stats
export interface DashboardStats {
  from: string;
  to: string;
  employees: (Totals & { employee: EmployeeRef })[];
  machines: (Totals & { machine: MachineRef })[];
  stoppedMinutes: { reason: StopReason; minutes: number }[];
}
