import { z } from 'zod';

export const orderStatus = z.enum(['PENDING', 'IN_PROGRESS', 'DONE', 'CANCELLED']);
export type OrderStatus = z.infer<typeof orderStatus>;

// Textos para los mensajes de error que ve el usuario
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En curso',
  DONE: 'Terminada',
  CANCELLED: 'Cancelada',
};

// Desde cada estado, a cuáles se puede pasar. DONE y CANCELLED son finales
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['DONE', 'CANCELLED'],
  DONE: [],
  CANCELLED: [],
};

export const orderIdParams = z.object({
  id: z.coerce.number().int().positive(),
});

// Filtros opcionales por query: /api/orders?status=PENDING&machineId=2
export const listOrdersQuery = z.object({
  status: orderStatus.optional(),
  machineId: z.coerce.number().int().positive().optional(),
});

export const createOrderBody = z.object({
  code: z.string().min(1).max(30),
  product: z.string().min(1).max(100),
  quantity: z.number().int().positive(),
  machineId: z.number().int().positive().nullable().optional(),
  // null = sin planificar (sale del Gantt)
  plannedStart: z.coerce.date().nullable().optional(),
  // Segundos por pieza a ritmo ideal; sin él la orden no cuenta para el Rendimiento del OEE
  cycleTimeSec: z.number().positive().max(86_400).nullable().optional(),
});

// producedQty no se edita: es la suma de los WorkLog de la orden
export const updateOrderBody = createOrderBody.partial();

export const changeStatusBody = z.object({
  status: orderStatus,
});

// employeeId null = desasignar
export const assignEmployeeBody = z.object({
  employeeId: z.number().int().positive().nullable(),
});

export type CreateOrderBody = z.infer<typeof createOrderBody>;
