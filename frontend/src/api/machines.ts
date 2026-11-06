import type { Machine, MachineDetail, MachineStatus } from '../types/machine';
import { apiFetch } from './client';

// POST y PATCH devuelven la máquina sin _count
export type MachineRecord = Omit<Machine, '_count'>;

export interface CreateMachineInput {
  code: string;
  name: string;
  status?: MachineStatus;
}

export type UpdateMachineInput = Partial<CreateMachineInput>;

export function getMachines(): Promise<Machine[]> {
  return apiFetch<Machine[]>('/machines');
}

export function getMachineDetail(id: number, from: string, to: string): Promise<MachineDetail> {
  const params = new URLSearchParams({ from, to });
  return apiFetch<MachineDetail>(`/machines/${id}/detail?${params}`);
}

export function createMachine(data: CreateMachineInput): Promise<MachineRecord> {
  return apiFetch<MachineRecord>('/machines', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateMachine(id: number, data: UpdateMachineInput): Promise<MachineRecord> {
  return apiFetch<MachineRecord>(`/machines/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteMachine(id: number): Promise<void> {
  return apiFetch<void>(`/machines/${id}`, { method: 'DELETE' });
}
