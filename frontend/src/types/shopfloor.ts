import type { OrderStatus } from './order';
import type { StopReason } from './worklog';

// Orden tal como la devuelve GET /api/shopfloor/orders (solo PENDING o IN_PROGRESS)
export interface ShopfloorOrder {
  id: number;
  code: string;
  product: string;
  quantity: number;
  producedQty: number;
  status: OrderStatus;
  plannedStart: string | null;
  machine: { code: string; name: string } | null;
  // WorkLog abierto del propio empleado; como mucho uno entre todas sus órdenes
  openWorkLog: { id: number; startedAt: string } | null;
}

// La orden en la que el empleado está trabajando ahora
export type ActiveShopfloorOrder = ShopfloorOrder & {
  openWorkLog: NonNullable<ShopfloorOrder['openWorkLog']>;
};

export interface StartWorkResponse {
  id: number;
  orderId: number;
  startedAt: string;
}

export interface StopWorkInput {
  producedQty: number;
  stopReason: StopReason;
  // Obligatoria si stopReason es MACHINE_ISSUE
  note?: string;
}

export interface StopWorkResponse {
  workLog: { id: number; producedQty: number; stopReason: StopReason; note: string | null };
  order: { id: number; code: string; status: OrderStatus; quantity: number; producedQty: number };
}
