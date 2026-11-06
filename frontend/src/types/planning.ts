import type { MachineStatus } from './machine';
import type { OrderEmployee, OrderStatus } from './order';

// Orden PENDING/IN_PROGRESS de GET /api/planning. estimatedStart/End = null si no tiene
// inicio (plannedStart, o startedAt si está en curso) o no tiene ciclo
export interface PlanningOrder {
  id: number;
  code: string;
  product: string;
  status: OrderStatus;
  quantity: number;
  producedQty: number;
  cycleTimeSec: number | null;
  // Puesto en la cola de su máquina; null = sin colocar (al final)
  priority: number | null;
  plannedStart: string | null;
  startedAt: string | null;
  assignedEmployee: OrderEmployee | null;
  estimatedStart: string | null;
  estimatedEnd: string | null;
  // Órdenes de la misma máquina cuya ventana se cruza con esta
  overlapsWith: number[];
}

// orders ya viene en orden de cola
export interface PlanningMachine {
  id: number;
  code: string;
  name: string;
  status: MachineStatus;
  orders: PlanningOrder[];
}

export interface Planning {
  timeZone: string;
  machines: PlanningMachine[];
  withoutMachine: PlanningOrder[];
}
