import { Alert, Button, Group, Modal, Select, Stack, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import type { AssignEmployeeInput } from '../../api/orders';
import { useEmployees } from '../../hooks/useEmployees';
import type { ProductionOrder } from '../../types/order';

interface AssignEmployeeModalProps {
  // null mientras no se ha elegido ninguna orden
  order: ProductionOrder | null;
  opened: boolean;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (data: AssignEmployeeInput) => void;
}

export function AssignEmployeeModal({ order, opened, loading, onClose, onSubmit }: AssignEmployeeModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={order ? `Empleado de ${order.code}` : 'Asignar empleado'}
    >
      {order && (
        <AssignEmployeeForm order={order} loading={loading} onSubmit={onSubmit} onCancel={onClose} />
      )}
    </Modal>
  );
}

interface AssignEmployeeFormValues {
  // Select trabaja con strings; null = sin empleado
  employeeId: string | null;
}

interface AssignEmployeeFormProps {
  order: ProductionOrder;
  loading?: boolean;
  onSubmit: (data: AssignEmployeeInput) => void;
  onCancel: () => void;
}

function AssignEmployeeForm({ order, loading, onSubmit, onCancel }: AssignEmployeeFormProps) {
  const { data: employees, isPending } = useEmployees();
  // Igual que el backend: con alguien trabajando (WorkLog abierto) no se reasigna
  const someoneWorking = order.openWorkLog !== null;
  const currentId = order.assignedEmployeeId === null ? null : String(order.assignedEmployeeId);

  const options = (employees ?? [])
    .filter((e) => e.active)
    .map((e) => ({ value: String(e.id), label: `${e.code} · ${e.name}` }));

  // 2º genérico: tipo que devuelve transformValues, que es lo que recibe onSubmit
  const form = useForm<
    AssignEmployeeFormValues,
    (values: AssignEmployeeFormValues) => AssignEmployeeInput
  >({
    initialValues: { employeeId: currentId },
    validate: {
      employeeId: (value) => (value === currentId ? 'Elige un empleado distinto del actual' : null),
    },
    transformValues: (values) => ({
      employeeId: values.employeeId === null ? null : Number(values.employeeId),
    }),
  });

  return (
    <form onSubmit={form.onSubmit(onSubmit)}>
      <Stack>
        <Text size="sm">
          Empleado actual: <b>{order.assignedEmployee ? order.assignedEmployee.name : 'ninguno'}</b>
        </Text>
        {someoneWorking && (
          <Alert color="yellow" variant="light" title="Hay alguien trabajando">
            {order.assignedEmployee?.name ?? 'El empleado'} tiene un trabajo abierto en esta orden.
            Podrás reasignarla cuando lo finalice desde planta.
          </Alert>
        )}
        <Select
          label="Nuevo empleado"
          placeholder="Sin empleado"
          description="Solo empleados activos. Déjalo vacío para quitar el empleado."
          data={options}
          disabled={isPending || someoneWorking}
          searchable
          clearable
          nothingFoundMessage="Sin resultados"
          {...form.getInputProps('employeeId')}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading} disabled={someoneWorking}>
            Guardar
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
