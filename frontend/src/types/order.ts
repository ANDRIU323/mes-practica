export type OrderStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';

// Máquina tal como la incluye GET /api/orders (solo id, code y name)
export interface OrderMachine {
  id: number;
  code: string;
  name: string;
}

// Empleado asignado tal como lo incluye GET /api/orders
export interface OrderEmployee {
  id: number;
  code: string;
  name: string;
}

// Tramo de trabajo sin cerrar (como mucho uno por orden)
export interface OpenWorkLog {
  id: number;
  employeeId: number;
  startedAt: string;
}

// Las fechas llegan como string ISO porque el JSON no tiene tipo Date
export interface ProductionOrder {
  id: number;
  code: string;
  product: string;
  quantity: number;
  producedQty: number;
  // Segundos por pieza a ritmo ideal (Rendimiento del OEE); null = sin definir
  cycleTimeSec: number | null;
  status: OrderStatus;
  machineId: number | null;
  machine: OrderMachine | null;
  assignedEmployeeId: number | null;
  assignedEmployee: OrderEmployee | null;
  openWorkLog: OpenWorkLog | null;
  plannedStart: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
