import type { StopReason } from './worklog';

export interface Employee {
  id: number;
  code: string;
  name: string;
  active: boolean;
  // Bloqueado por intentos fallidos de PIN si es posterior a ahora
  lockedUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

// Empleado tal como lo devuelve GET /api/employees (con totales de sus WorkLog)
export interface EmployeeWithTotals extends Employee {
  totalHours: number;
  totalUnits: number;
  // Sin PIN no puede entrar en planta
  hasPin: boolean;
}

// GET /api/employees/:id/stats
export interface EmployeeOrderStats {
  orderId: number;
  code: string;
  product: string;
  hours: number;
  units: number;
  // true si el empleado tiene ahora un WorkLog abierto en la orden
  open: boolean;
}

// Un tramo de trabajo; endedAt y stopReason son null mientras está abierto
export interface EmployeeWorkLog {
  id: number;
  orderCode: string;
  startedAt: string;
  endedAt: string | null;
  hours: number;
  producedQty: number;
  stopReason: StopReason | null;
  note: string | null;
}

export interface EmployeeStats {
  employee: Employee;
  totalHours: number;
  totalUnits: number;
  orders: EmployeeOrderStats[];
  // Del más reciente al más antiguo
  workLogs: EmployeeWorkLog[];
}
