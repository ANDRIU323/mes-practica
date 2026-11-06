import type { OrderStatus } from './order';

export type MachineStatus = 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE';

// Máquina tal como la devuelve GET /api/machines (incluye el nº de órdenes)
export interface Machine {
  id: number;
  code: string;
  name: string;
  status: MachineStatus;
  createdAt: string;
  updatedAt: string;
  _count: { orders: number };
}

interface EmployeeRef {
  id: number;
  code: string;
  name: string;
}

// GET /api/machines/:id/detail?from=&to=
export interface MachineDetail {
  machine: Pick<Machine, 'id' | 'code' | 'name' | 'status' | 'createdAt'>;
  from: string;
  to: string;
  metrics: {
    workedHours: number;
    maintenanceHours: number;
    failures: number;
    mtbfHours: number | null;
  };
  orders: MachineDetailOrder[];
  incidents: MachineIncident[];
  maintenances: MachineMaintenance[];
}

export interface MachineDetailOrder {
  id: number;
  code: string;
  product: string;
  quantity: number;
  producedQty: number;
  status: OrderStatus;
  plannedStart: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  assignedEmployee: EmployeeRef | null;
}

export interface MachineIncident {
  id: number;
  endedAt: string;
  note: string | null;
  employee: EmployeeRef;
  order: { id: number; code: string };
  // null si la máquina ya estaba en mantenimiento al registrarla
  maintenance: { startedAt: string; endedAt: string | null } | null;
}

// orderCode y note: los de la incidencia que lo abrió (null si se puso a mano)
export interface MachineMaintenance {
  id: number;
  startedAt: string;
  endedAt: string | null;
  orderCode: string | null;
  note: string | null;
}
