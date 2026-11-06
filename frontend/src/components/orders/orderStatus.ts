import type { OrderStatus } from '../../types/order';

// Compartido por el Badge, el Dashboard y los filtros de órdenes
export const ORDER_STATUS_CONFIG: Record<OrderStatus, { label: string; color: string }> = {
  PENDING: { label: 'Pendiente', color: 'gray' },
  IN_PROGRESS: { label: 'En curso', color: 'blue' },
  DONE: { label: 'Terminada', color: 'green' },
  CANCELLED: { label: 'Cancelada', color: 'red' },
};

export const ORDER_STATUSES = Object.keys(ORDER_STATUS_CONFIG) as OrderStatus[];

// Copia de ORDER_TRANSITIONS del backend: el menú solo ofrece los cambios que la API acepta
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['DONE', 'CANCELLED'],
  DONE: [],
  CANCELLED: [],
};
