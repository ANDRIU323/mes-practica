import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import {
  createMachine,
  deleteMachine,
  getMachineDetail,
  getMachines,
  updateMachine,
  type CreateMachineInput,
  type UpdateMachineInput,
} from '../api/machines';
import type { ReportRange } from '../store/uiSlice';
import { DASHBOARD_KEY, MACHINES_KEY, ORDERS_KEY, machineDetailKey } from './queryKeys';

function notifyError(error: Error) {
  notifications.show({ color: 'red', title: 'Error', message: error.message });
}

export function useMachines() {
  return useQuery({
    queryKey: MACHINES_KEY,
    queryFn: getMachines,
  });
}

// Las incidencias llegan desde planta (otra sesión): la refresca useRealtime.
// keepPreviousData: al cambiar el rango, la página no se vacía mientras carga
export function useMachineDetail(id: number, range: ReportRange) {
  return useQuery({
    queryKey: machineDetailKey(id, range.from, range.to),
    queryFn: () => getMachineDetail(id, range.from, range.to),
    placeholderData: keepPreviousData,
  });
}

export function useCreateMachine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateMachineInput) => createMachine(data),
    onSuccess: (machine) => {
      queryClient.invalidateQueries({ queryKey: MACHINES_KEY });
      notifications.show({ color: 'green', message: `Máquina ${machine.code} creada` });
    },
    onError: notifyError,
  });
}

// La lista de órdenes muestra el código de la máquina, y el dashboard su nombre y estado
export function useUpdateMachine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateMachineInput }) =>
      updateMachine(id, data),
    onSuccess: (machine) => {
      notifications.show({ color: 'green', message: `Máquina ${machine.code} actualizada` });
    },
    onError: notifyError,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: MACHINES_KEY });
      queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
      queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });
    },
  });
}

// Las órdenes de la máquina se quedan sin máquina (SetNull)
export function useDeleteMachine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteMachine(id),
    onSuccess: () => {
      notifications.show({ color: 'green', message: 'Máquina eliminada' });
    },
    onError: notifyError,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: MACHINES_KEY });
      queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
    },
  });
}
