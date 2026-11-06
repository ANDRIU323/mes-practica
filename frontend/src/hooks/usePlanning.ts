import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { updateOrder } from '../api/orders';
import { getPlanning, putMachineSequence } from '../api/planning';
import type { Planning } from '../types/planning';
import { ORDERS_KEY, PLANNING_KEY } from './queryKeys';

const REORDER_KEY = ['planning', 'reorder'];

function notifyError(error: Error) {
  notifications.show({ color: 'red', title: 'Error', message: error.message });
}

// Lo que cambia desde planta lo refresca useRealtime (cuelga de ORDERS_KEY). El intervalo
// es por el reloj: el fin estimado de una orden en curso avanza aunque nadie toque nada
export function usePlanning() {
  return useQuery({
    queryKey: PLANNING_KEY,
    queryFn: getPlanning,
    refetchInterval: 60_000,
  });
}

// Copia de la planificación con la cola de una máquina en el orden nuevo
export function applySequence(planning: Planning, machineId: number, orderIds: number[]): Planning {
  return {
    ...planning,
    machines: planning.machines.map((machine) => {
      if (machine.id !== machineId) return machine;
      const byId = new Map(machine.orders.map((o) => [o.id, o]));
      return {
        ...machine,
        orders: orderIds.flatMap((id, priority) => {
          const order = byId.get(id);
          return order ? [{ ...order, priority }] : [];
        }),
      };
    }),
  };
}

// Actualización optimista: la lista cambia al soltar, sin esperar al servidor.
// 1) onMutate: cancela lecturas en curso (pisarían el cambio), guarda la foto actual y
//    escribe la nueva en la caché. 2) onError: vuelve a la foto. 3) onSettled: refresca
//    para quedarse con lo que diga el servidor
export function useReorderQueue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: REORDER_KEY,
    mutationFn: ({ machineId, orderIds }: { machineId: number; orderIds: number[] }) =>
      putMachineSequence(machineId, orderIds),
    onMutate: async ({ machineId, orderIds }) => {
      await queryClient.cancelQueries({ queryKey: PLANNING_KEY });
      const previous = queryClient.getQueryData<Planning>(PLANNING_KEY);
      queryClient.setQueryData<Planning>(PLANNING_KEY, (old) => old && applySequence(old, machineId, orderIds));
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(PLANNING_KEY, context.previous);
      notifyError(error);
    },
    // Con varios arrastres seguidos, solo refresca el último: si refrescara antes, la
    // respuesta (sin los cambios aún en vuelo) desharía en pantalla los siguientes
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: REORDER_KEY }) === 1) {
        return queryClient.invalidateQueries({ queryKey: PLANNING_KEY });
      }
    },
  });
}

// plannedStart en ISO; null = quitar la fecha. ORDERS_KEY incluye la planificación
export function useSetPlannedStart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, plannedStart }: { id: number; plannedStart: string | null }) =>
      updateOrder(id, { plannedStart }),
    onSuccess: (order) => {
      notifications.show({ color: 'green', message: `Inicio previsto de ${order.code} guardado` });
    },
    onError: notifyError,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ORDERS_KEY }),
  });
}
