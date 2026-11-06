import { Button, Group, Stack, Switch, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import type { Employee } from '../../types/employee';

export interface EmployeeFormValues {
  code: string;
  name: string;
  active: boolean;
}

interface EmployeeFormProps {
  // Sin empleado = crear; con empleado = editar
  employee?: Employee;
  loading?: boolean;
  onSubmit: (values: EmployeeFormValues) => void;
  onCancel: () => void;
}

export function EmployeeForm({ employee, loading, onSubmit, onCancel }: EmployeeFormProps) {
  const form = useForm<EmployeeFormValues>({
    initialValues: {
      code: employee?.code ?? '',
      name: employee?.name ?? '',
      active: employee?.active ?? true,
    },
    // Mismos límites que createEmployeeBody en el backend
    validate: {
      code: (value) => {
        const v = value.trim();
        if (!v) return 'El código es obligatorio';
        if (v.length > 20) return 'Máximo 20 caracteres';
        return null;
      },
      name: (value) => {
        const v = value.trim();
        if (!v) return 'El nombre es obligatorio';
        if (v.length > 100) return 'Máximo 100 caracteres';
        return null;
      },
    },
    transformValues: (values) => ({
      ...values,
      code: values.code.trim(),
      name: values.name.trim(),
    }),
  });

  return (
    <form onSubmit={form.onSubmit(onSubmit)}>
      <Stack>
        <TextInput
          label="Código"
          placeholder="EMP-01"
          withAsterisk
          maxLength={20}
          {...form.getInputProps('code')}
        />
        <TextInput
          label="Nombre"
          placeholder="Ana López"
          withAsterisk
          maxLength={100}
          {...form.getInputProps('name')}
        />
        <Switch
          label="Activo"
          description="Solo los empleados activos se pueden asignar a órdenes"
          {...form.getInputProps('active', { type: 'checkbox' })}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            {employee ? 'Guardar' : 'Crear'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
