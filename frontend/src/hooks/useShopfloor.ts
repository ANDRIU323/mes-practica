import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { getShopfloorOrders, startWork, stopWork } from '../api/shopfloor';
import type { StopWorkInput } from '../types/shopfloor';
import { SHOPFLOOR_KEY } from './queryKeys';

function notifyError(error: Error) {
  notifications.show({ color: 'red', title: 'Error', message: error.message });
}

// La pantalla de planta se queda abierta todo el turno: se refresca sola por si
// el administrador asigna o quita órdenes
export function useShopfloorOrders() {
  return useQuery({
    queryKey: SHOPFLOOR_KEY,
    queryFn: getShopfloorOrders,
    refetchInterval: 30_000,
  });
}

export function useStartWork() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: number) => startWork(orderId),
    onSuccess: () => {
      notifications.show({ color: 'green', message: 'Trabajo iniciado' });
    },
    onError: notifyError,
    onSettled: () => queryClient.invalidateQueries({ queryKey: SHOPFLOOR_KEY }),
  });
}

export function useStopWork() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workLogId, data }: { workLogId: number; data: StopWorkInput }) =>
      stopWork(workLogId, data),
    onSuccess: ({ workLog, order }) => {
      notifications.show(
        order.status === 'DONE'
          ? {
              color: 'green',
              title: `Orden ${order.code} terminada`,
              message: `${order.producedQty} de ${order.quantity} unidades`,
            }
          : { color: 'green', message: `Trabajo finalizado: ${workLog.producedQty} unidades` },
      );
    },
    onError: notifyError,
    onSettled: () => queryClient.invalidateQueries({ queryKey: SHOPFLOOR_KEY }),
  });
}
