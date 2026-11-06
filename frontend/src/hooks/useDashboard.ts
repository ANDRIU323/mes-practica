import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getDashboardOee, getDashboardStats, getIncidents, getLiveWork } from '../api/dashboard';
import type { ReportRange } from '../store/uiSlice';
import {
  DASHBOARD_INCIDENTS_KEY,
  DASHBOARD_LIVE_KEY,
  dashboardOeeKey,
  dashboardStatsKey,
} from './queryKeys';

// Los WorkLog se abren y cierran desde planta (otra sesión): estas claves
// las invalida useRealtime cuando el servidor avisa
export function useLiveWork() {
  return useQuery({
    queryKey: DASHBOARD_LIVE_KEY,
    queryFn: getLiveWork,
  });
}

export function useIncidents() {
  return useQuery({
    queryKey: DASHBOARD_INCIDENTS_KEY,
    queryFn: () => getIncidents(),
  });
}

// keepPreviousData: al cambiar el rango, los gráficos no se vacían mientras carga
export function useDashboardStats(range: ReportRange) {
  return useQuery({
    queryKey: dashboardStatsKey(range.from, range.to),
    queryFn: () => getDashboardStats(range.from, range.to),
    placeholderData: keepPreviousData,
  });
}

export function useDashboardOee(range: ReportRange) {
  return useQuery({
    queryKey: dashboardOeeKey(range.from, range.to),
    queryFn: () => getDashboardOee(range.from, range.to),
    placeholderData: keepPreviousData,
  });
}
