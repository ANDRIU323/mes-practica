import type { OrderStatus, ProductionOrder } from '../types/order';
import type { OrdersImportPreview, OrdersImportResult } from '../types/orderImport';
import { apiFetch, apiFetchBlob } from './client';

// GET /api/orders/summary solo devuelve los estados que tienen alguna orden
export interface OrderStatusCount {
  status: OrderStatus;
  count: number;
}

// POST y PATCH devuelven la orden sin las relaciones incluidas
export type OrderRecord = Omit<ProductionOrder, 'machine' | 'assignedEmployee' | 'openWorkLog'>;

export interface CreateOrderInput {
  code: string;
  product: string;
  quantity: number;
  machineId?: number | null;
  cycleTimeSec?: number | null;
}

// producedQty no se edita: el backend lo calcula sumando los WorkLog
// plannedStart (ISO; null = sin planificar) solo se edita desde Planificación
export type UpdateOrderInput = Partial<CreateOrderInput> & { plannedStart?: string | null };

// employeeId null = desasignar. Con un WorkLog abierto el backend responde 400
export interface AssignEmployeeInput {
  employeeId: number | null;
}

export function getOrders(status?: OrderStatus | null): Promise<ProductionOrder[]> {
  const query = status ? `?${new URLSearchParams({ status })}` : '';
  return apiFetch<ProductionOrder[]>(`/orders${query}`);
}

export function getOrdersSummary(): Promise<OrderStatusCount[]> {
  return apiFetch<OrderStatusCount[]>('/orders/summary');
}

export function createOrder(data: CreateOrderInput): Promise<OrderRecord> {
  return apiFetch<OrderRecord>('/orders', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateOrder(id: number, data: UpdateOrderInput): Promise<OrderRecord> {
  return apiFetch<OrderRecord>(`/orders/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// Con un WorkLog abierto no se puede terminar ni cancelar (400)
export interface ChangeStatusInput {
  status: OrderStatus;
}

export function changeOrderStatus(id: number, data: ChangeStatusInput): Promise<OrderRecord> {
  return apiFetch<OrderRecord>(`/orders/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function assignEmployee(id: number, data: AssignEmployeeInput): Promise<OrderRecord> {
  return apiFetch<OrderRecord>(`/orders/${id}/assign`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteOrder(id: number): Promise<void> {
  return apiFetch<void>(`/orders/${id}`, { method: 'DELETE' });
}

function fileForm(file: File) {
  const form = new FormData();
  form.append('file', file);
  return form;
}

// Valida el Excel sin guardar nada
export function previewOrdersImport(file: File): Promise<OrdersImportPreview> {
  return apiFetch<OrdersImportPreview>('/orders/import/preview', { method: 'POST', body: fileForm(file) });
}

// Todo o nada: con algún error responde 400 y no crea ninguna orden
export function importOrders(file: File): Promise<OrdersImportResult> {
  return apiFetch<OrdersImportResult>('/orders/import', { method: 'POST', body: fileForm(file) });
}

// Mismo filtro de estado que la tabla
export function exportOrders(status?: OrderStatus | null): Promise<Blob> {
  const query = status ? `?${new URLSearchParams({ status })}` : '';
  return apiFetchBlob(`/orders/export${query}`);
}

export function getOrdersImportTemplate(): Promise<Blob> {
  return apiFetchBlob('/orders/import/template');
}
