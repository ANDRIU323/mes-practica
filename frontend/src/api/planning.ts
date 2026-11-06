import type { Planning } from '../types/planning';
import { apiFetch } from './client';

export function getPlanning(): Promise<Planning> {
  return apiFetch<Planning>('/planning');
}

// La cola completa, de la primera a la última. 409 si ya no coincide con la del servidor
export function putMachineSequence(machineId: number, orderIds: number[]): Promise<void> {
  return apiFetch<void>(`/planning/machines/${machineId}/sequence`, {
    method: 'PUT',
    body: JSON.stringify({ orderIds }),
  });
}
