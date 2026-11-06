import type { CloseShiftResult, ShiftKey, ShiftList, ShiftReport } from '../types/shift';
import { apiFetch } from './client';

// Sin día, el backend devuelve el del turno actual (en hora de la planta)
export function getShifts(day: string | null): Promise<ShiftList> {
  const query = day ? `?${new URLSearchParams({ from: day, to: day })}` : '';
  return apiFetch<ShiftList>(`/shifts${query}`);
}

export function getShiftReport({ date, type }: ShiftKey): Promise<ShiftReport> {
  return apiFetch<ShiftReport>(`/shifts/${date}/${type}`);
}

// Sin force, un 409 con openWorkLogs si quedan WorkLog abiertos
export function closeShift({ date, type }: ShiftKey, force: boolean): Promise<CloseShiftResult> {
  return apiFetch<CloseShiftResult>(`/shifts/${date}/${type}/close`, {
    method: 'POST',
    body: JSON.stringify({ force }),
  });
}
