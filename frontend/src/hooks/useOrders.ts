import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import {
  assignEmployee,
  changeOrderStatus,
  createOrder,
  deleteOrder,
  exportOrders,
  getOrders,
  getOrdersImportTemplate,
  getOrdersSummary,
  importOrders,
  previewOrdersImport,
  updateOrder,
  type AssignEmployeeInput,
  type ChangeStatusInput,
  type CreateOrderInput,
  type UpdateOrderInput,
} from '../api/orders';
import type { OrderStatus } from '../types/order';
import { downloadBlob } from '../utils/downloadBlob';
import { EMPLOYEES_KEY, MACHINES_KEY, ORDERS_KEY } from './queryKeys';

function notifyError(error: Error) {
  notifications.show({ color: 'red', title: 'Error', message: error.message });
}

// Los empleados inician y finalizan trabajos desde planta: la refresca useRealtime
export function useOrders(status: OrderStatus | null = null) {
  return useQuery({
    queryKey: [...ORDERS_KEY, { status }],
    queryFn: () => getOrders(status),
  });
}

export function useOrdersSummary() {
  return useQuery({
    queryKey: [...ORDERS_KEY, 'summary'],
    queryFn: getOrdersSummary,
  });
}

// Las invalidaciones van en onSettled (éxito o error): tras un 400 la caché puede estar
// desactualizada, p. ej. otra persona cambió el estado de la orden o de la máquina.
// MACHINES_KEY: la lista de máquinas incluye el nº de órdenes de cada una.

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateOrderInput) => createOrder(data),
    onSuccess: (order) => {
      notifications.show({ color: 'green', message: `Orden ${order.code} creada` });
    },
    onError: notifyError,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
      queryClient.invalidateQueries({ queryKey: MACHINES_KEY });
    },
  });
}

export function useUpdateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateOrderInput }) => updateOrder(id, data),
    onSuccess: (order) => {
      notifications.show({ color: 'green', message: `Orden ${order.code} actualizada` });
    },
    onError: notifyError,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
      queryClient.invalidateQueries({ queryKey: MACHINES_KEY });
    },
  });
}

// Los WorkLog solo los abre y cierra el empleado desde planta: cambiar el estado o el
// empleado no toca horas ni unidades, así que no hace falta invalidar EMPLOYEES_KEY
export function useChangeOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ChangeStatusInput }) =>
      changeOrderStatus(id, data),
    onSuccess: (order) => {
      notifications.show({ color: 'green', message: `Orden ${order.code} actualizada` });
    },
    onError: notifyError,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ORDERS_KEY }),
  });
}

export function useAssignEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: AssignEmployeeInput }) =>
      assignEmployee(id, data),
    onSuccess: (order) => {
      notifications.show({
        color: 'green',
        message: order.assignedEmployeeId
          ? `Empleado asignado a ${order.code}`
          : `Orden ${order.code} sin empleado`,
      });
    },
    onError: notifyError,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ORDERS_KEY }),
  });
}

export function useDeleteOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteOrder(id),
    onSuccess: () => {
      notifications.show({ color: 'green', message: 'Orden eliminada' });
    },
    onError: notifyError,
    // Sus WorkLog se borran en cascada: cambian las horas y unidades de los empleados
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
      queryClient.invalidateQueries({ queryKey: MACHINES_KEY });
      queryClient.invalidateQueries({ queryKey: EMPLOYEES_KEY });
    },
  });
}

// Mutación y no query: es una acción sobre un archivo, no datos que se guarden en caché.
// El error se muestra dentro del modal, no como notificación
export function usePreviewOrdersImport() {
  return useMutation({ mutationFn: (file: File) => previewOrdersImport(file) });
}

export function useImportOrders() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => importOrders(file),
    onSuccess: ({ created }) => {
      notifications.show({ color: 'green', message: `${created} órdenes importadas` });
    },
    onError: notifyError,
    // ORDERS_KEY incluye el resumen del dashboard (['orders', 'summary'])
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
      queryClient.invalidateQueries({ queryKey: MACHINES_KEY });
    },
  });
}

export function useExportOrders() {
  return useMutation({
    mutationFn: exportOrders,
    onSuccess: (blob) => downloadBlob('ordenes.xlsx', blob),
    onError: notifyError,
  });
}

export function useDownloadOrdersTemplate() {
  return useMutation({
    mutationFn: getOrdersImportTemplate,
    onSuccess: (blob) => downloadBlob('plantilla-ordenes.xlsx', blob),
    onError: notifyError,
  });
}
