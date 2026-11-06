import { Button, Group, Select, Stack, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import type { Machine, MachineStatus } from '../../types/machine';
import { MACHINE_STATUS_CONFIG } from './machineStatus';

export interface MachineFormValues {
  code: string;
  name: string;
  status: MachineStatus;
}

interface MachineFormProps {
  // Sin máquina = crear; con máquina = editar
  machine?: Machine;
  loading?: boolean;
  onSubmit: (values: MachineFormValues) => void;
  onCancel: () => void;
}

const STATUS_OPTIONS = Object.entries(MACHINE_STATUS_CONFIG).map(([value, { label }]) => ({
  value,
  label,
}));

export function MachineForm({ machine, loading, onSubmit, onCancel }: MachineFormProps) {
  const form = useForm<MachineFormValues>({
    initialValues: {
      code: machine?.code ?? '',
      name: machine?.name ?? '',
      status: machine?.status ?? 'ACTIVE',
    },
    // Mismos límites que createMachineBody en el backend
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
          placeholder="MAQ-01"
          withAsterisk
          maxLength={20}
          {...form.getInputProps('code')}
        />
        <TextInput
          label="Nombre"
          placeholder="Torno CNC"
          withAsterisk
          maxLength={100}
          {...form.getInputProps('name')}
        />
        <Select
          label="Estado"
          data={STATUS_OPTIONS}
          allowDeselect={false}
          {...form.getInputProps('status')}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            {machine ? 'Guardar' : 'Crear'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
