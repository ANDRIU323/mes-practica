import { useState } from 'react';
import { Alert, Button, Center, Group, Loader, Modal, Stack, Text, Title } from '@mantine/core';
import { EmployeeDetailDrawer } from '../components/employees/EmployeeDetailDrawer';
import { EmployeeForm, type EmployeeFormValues } from '../components/employees/EmployeeForm';
import { EmployeeTable } from '../components/employees/EmployeeTable';
import { SetPinModal } from '../components/employees/SetPinModal';
import {
  useCreateEmployee,
  useDeleteEmployee,
  useEmployees,
  useUpdateEmployee,
} from '../hooks/useEmployees';
import { useAppDispatch } from '../store/hooks';
import { setSelectedEmployeeId } from '../store/uiSlice';
import type { EmployeeWithTotals } from '../types/employee';

export function EmployeesPage() {
  const dispatch = useAppDispatch();
  const { data: employees, isPending, isError, error } = useEmployees();
  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();
  const deleteEmployee = useDeleteEmployee();

  const [formOpened, setFormOpened] = useState(false);
  // undefined = crear. No se limpia al cerrar para que el título no cambie durante la animación
  const [editingEmployee, setEditingEmployee] = useState<EmployeeWithTotals | undefined>();
  const [pinEmployee, setPinEmployee] = useState<EmployeeWithTotals | null>(null);

  const openCreate = () => {
    setEditingEmployee(undefined);
    setFormOpened(true);
  };

  const openEdit = (employee: EmployeeWithTotals) => {
    setEditingEmployee(employee);
    setFormOpened(true);
  };

  const closeForm = () => setFormOpened(false);

  const handleSubmit = (values: EmployeeFormValues) => {
    if (editingEmployee) {
      updateEmployee.mutate({ id: editingEmployee.id, data: values }, { onSuccess: closeForm });
    } else {
      createEmployee.mutate(values, { onSuccess: closeForm });
    }
  };

  let content;
  if (isPending) {
    content = (
      <Center py="xl">
        <Loader />
      </Center>
    );
  } else if (isError) {
    content = (
      <Alert color="red" title="No se pudieron cargar los empleados">
        {error.message}
      </Alert>
    );
  } else if (employees.length === 0) {
    content = (
      <Text c="dimmed" ta="center" py="xl">
        No hay empleados.
      </Text>
    );
  } else {
    content = (
      <EmployeeTable
        employees={employees}
        onSelect={(employee) => dispatch(setSelectedEmployeeId(employee.id))}
        onEdit={openEdit}
        onSetPin={setPinEmployee}
        onDelete={(employee) => deleteEmployee.mutate(employee.id)}
      />
    );
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Empleados</Title>
        <Button onClick={openCreate}>Nuevo empleado</Button>
      </Group>
      {content}

      <Modal
        opened={formOpened}
        onClose={closeForm}
        title={editingEmployee ? `Editar ${editingEmployee.code}` : 'Nuevo empleado'}
      >
        <EmployeeForm
          employee={editingEmployee}
          loading={createEmployee.isPending || updateEmployee.isPending}
          onSubmit={handleSubmit}
          onCancel={closeForm}
        />
      </Modal>

      <SetPinModal employee={pinEmployee} onClose={() => setPinEmployee(null)} />

      <EmployeeDetailDrawer />
    </Stack>
  );
}
