import type { DashboardOee, DashboardStats, Incident, LiveWorkLog } from '../types/dashboard';
import { apiFetch } from './client';

export function getLiveWork(): Promise<LiveWorkLog[]> {
  return apiFetch<LiveWorkLog[]>('/dashboard/live');
}

export function getIncidents(limit = 10): Promise<Incident[]> {
  return apiFetch<Incident[]>(`/dashboard/incidents?limit=${limit}`);
}

// from/to: días "YYYY-MM-DD" incluidos; el backend los pasa a la zona de la planta
export function getDashboardStats(from: string, to: string): Promise<DashboardStats> {
  const params = new URLSearchParams({ from, to });
  return apiFetch<DashboardStats>(`/dashboard/stats?${params}`);
}

export function getDashboardOee(from: string, to: string): Promise<DashboardOee> {
  const params = new URLSearchParams({ from, to });
  return apiFetch<DashboardOee>(`/dashboard/oee?${params}`);
}
