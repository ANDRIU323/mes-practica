import { useState } from 'react';
import { Alert, Button, Center, Group, Loader, Modal, Stack, Text, Title } from '@mantine/core';
import { MachineForm, type MachineFormValues } from '../components/machines/MachineForm';
import { MachineTable } from '../components/machines/MachineTable';
import {
  useCreateMachine,
  useDeleteMachine,
  useMachines,
  useUpdateMachine,
} from '../hooks/useMachines';
import type { Machine } from '../types/machine';

export function MachinesPage() {
  const { data: machines, isPending, isError, error } = useMachines();
  const createMachine = useCreateMachine();
  const updateMachine = useUpdateMachine();
  const deleteMachine = useDeleteMachine();

  const [formOpened, setFormOpened] = useState(false);
  // undefined = crear. No se limpia al cerrar para que el título no cambie durante la animación
  const [editingMachine, setEditingMachine] = useState<Machine | undefined>();

  const openCreate = () => {
    setEditingMachine(undefined);
    setFormOpened(true);
  };

  const openEdit = (machine: Machine) => {
    setEditingMachine(machine);
    setFormOpened(true);
  };

  const closeForm = () => setFormOpened(false);

  const handleSubmit = (values: MachineFormValues) => {
    if (editingMachine) {
      updateMachine.mutate({ id: editingMachine.id, data: values }, { onSuccess: closeForm });
    } else {
      createMachine.mutate(values, { onSuccess: closeForm });
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
      <Alert color="red" title="No se pudieron cargar las máquinas">
        {error.message}
      </Alert>
    );
  } else if (machines.length === 0) {
    content = (
      <Text c="dimmed" ta="center" py="xl">
        No hay máquinas.
      </Text>
    );
  } else {
    content = (
      <MachineTable
        machines={machines}
        onEdit={openEdit}
        onDelete={(machine) => deleteMachine.mutate(machine.id)}
      />
    );
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Máquinas</Title>
        <Button onClick={openCreate}>Nueva máquina</Button>
      </Group>
      {content}

      <Modal
        opened={formOpened}
        onClose={closeForm}
        title={editingMachine ? `Editar ${editingMachine.code}` : 'Nueva máquina'}
      >
        <MachineForm
          machine={editingMachine}
          loading={createMachine.isPending || updateMachine.isPending}
          onSubmit={handleSubmit}
          onCancel={closeForm}
        />
      </Modal>
    </Stack>
  );
}
