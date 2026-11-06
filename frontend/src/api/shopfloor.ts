import type {
  ShopfloorOrder,
  StartWorkResponse,
  StopWorkInput,
  StopWorkResponse,
} from '../types/shopfloor';
import { apiFetch } from './client';

export function getShopfloorOrders(): Promise<ShopfloorOrder[]> {
  return apiFetch<ShopfloorOrder[]>('/shopfloor/orders');
}

export function startWork(orderId: number): Promise<StartWorkResponse> {
  return apiFetch<StartWorkResponse>(`/shopfloor/orders/${orderId}/start`, { method: 'POST' });
}

export function stopWork(workLogId: number, data: StopWorkInput): Promise<StopWorkResponse> {
  return apiFetch<StopWorkResponse>(`/shopfloor/worklogs/${workLogId}/stop`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
