import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import {
  createEmployee,
  deleteEmployee,
  getEmployeeStats,
  getEmployees,
  setEmployeePin,
  updateEmployee,
  type CreateEmployeeInput,
  type UpdateEmployeeInput,
} from '../api/employees';
import { EMPLOYEES_KEY, ORDERS_KEY, employeeStatsKey } from './queryKeys';

function notifyError(error: Error) {
  notifications.show({ color: 'red', title: 'Error', message: error.message });
}

export function useEmployees() {
  return useQuery({
    queryKey: EMPLOYEES_KEY,
    queryFn: getEmployees,
  });
}

// id null = no se pide nada (Drawer cerrado). keepPreviousData mantiene los datos
// anteriores mientras se cierra el Drawer, para que no parpadee el Loader
export function useEmployeeStats(id: number | null) {
  return useQuery({
    queryKey: employeeStatsKey(id ?? 0),
    queryFn: () => getEmployeeStats(id!),
    enabled: id !== null,
    placeholderData: keepPreviousData,
  });
}

// Invalidaciones en onSettled, igual que en useOrders: tras un 409 la caché puede estar
// desactualizada. EMPLOYEES_KEY incluye la lista y las stats de cada empleado.

export function useCreateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateEmployeeInput) => createEmployee(data),
    onSuccess: (employee) => {
      notifications.show({ color: 'green', message: `Empleado ${employee.code} creado` });
    },
    onError: notifyError,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: EMPLOYEES_KEY });
    },
  });
}

// La lista de órdenes muestra el nombre del empleado asignado
export function useUpdateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateEmployeeInput }) =>
      updateEmployee(id, data),
    onSuccess: (employee) => {
      notifications.show({ color: 'green', message: `Empleado ${employee.code} actualizado` });
    },
    onError: notifyError,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: EMPLOYEES_KEY });
      queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
    },
  });
}

export function useSetEmployeePin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, pin }: { id: number; pin: string }) => setEmployeePin(id, pin),
    onSuccess: () => {
      notifications.show({ color: 'green', message: 'PIN guardado' });
    },
    onError: notifyError,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: EMPLOYEES_KEY });
    },
  });
}

// Las órdenes que tenía asignadas se quedan sin empleado (SetNull)
export function useDeleteEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteEmployee(id),
    onSuccess: () => {
      notifications.show({ color: 'green', message: 'Empleado eliminado' });
    },
    onError: notifyError,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: EMPLOYEES_KEY });
      queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
    },
  });
}
