import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { ApiError } from '../api/apiError';
import { closeShift, getShiftReport, getShifts } from '../api/shifts';
import type { OpenWorkLog, ShiftKey } from '../types/shift';
import { SHIFTS_KEY, shiftReportKey, shiftsListKey } from './queryKeys';

// Los WorkLog de planta los trae useRealtime; el intervalo queda para lo que cambia
// solo con la hora (ACTIVE → ENDED, horas de los WorkLog abiertos)
const SHIFTS_REFETCH_MS = 60_000;

export function useShifts(day: string | null) {
  return useQuery({
    queryKey: shiftsListKey(day),
    queryFn: () => getShifts(day),
    placeholderData: keepPreviousData,
    refetchInterval: SHIFTS_REFETCH_MS,
  });
}

// enabled: false con un turno que aún no ha empezado (el backend daría 400)
export function useShiftReport(key: ShiftKey | null) {
  return useQuery({
    queryKey: shiftReportKey(key?.date ?? '', key?.type ?? ''),
    queryFn: () => getShiftReport(key!),
    enabled: key !== null,
    placeholderData: keepPreviousData,
    refetchInterval: SHIFTS_REFETCH_MS,
  });
}

// WorkLog abiertos del 409 al cerrar sin force; null si el error es otro
export function openWorkLogsFromError(error: Error): OpenWorkLog[] | null {
  if (!(error instanceof ApiError) || error.status !== 409) return null;
  const body = error.body as { openWorkLogs?: OpenWorkLog[] } | null;
  return body?.openWorkLogs ?? null;
}

// El aviso de WorkLog abiertos lo gestiona quien llama (abre un modal); el resto, notificación
export function useCloseShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, force }: { key: ShiftKey; force: boolean }) => closeShift(key, force),
    onSuccess: ({ openWorkLogs }) => {
      notifications.show(
        openWorkLogs.length > 0
          ? {
              color: 'yellow',
              title: 'Turno cerrado',
              message: `Con ${openWorkLogs.length} registros de trabajo aún abiertos`,
            }
          : { color: 'green', message: 'Turno cerrado' },
      );
    },
    onError: (error) => {
      if (openWorkLogsFromError(error)) return;
      notifications.show({ color: 'red', title: 'Error', message: error.message });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: SHIFTS_KEY });
    },
  });
}
