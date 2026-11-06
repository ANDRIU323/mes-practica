import { useState } from 'react';
import { Anchor, Button, Group, Popover, Stack, Table, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import type { Machine } from '../../types/machine';
import { MachineStatusBadge } from './MachineStatusBadge';

interface MachineTableProps {
  machines: Machine[];
  onEdit: (machine: Machine) => void;
  onDelete: (machine: Machine) => void;
}

export function MachineTable({ machines, onEdit, onDelete }: MachineTableProps) {
  const rows = machines.map((machine) => (
    <Table.Tr key={machine.id}>
      <Table.Td>
        <Anchor component={Link} to={`/machines/${machine.id}`} fw={500}>
          {machine.code}
        </Anchor>
      </Table.Td>
      <Table.Td>{machine.name}</Table.Td>
      <Table.Td>
        <MachineStatusBadge status={machine.status} />
      </Table.Td>
      <Table.Td ta="right">{machine._count.orders}</Table.Td>
      <Table.Td>
        <Group gap="xs" justify="flex-end">
          <Button size="xs" variant="light" onClick={() => onEdit(machine)}>
            Editar
          </Button>
          <DeleteButton machine={machine} onConfirm={() => onDelete(machine)} />
        </Group>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <Table.ScrollContainer minWidth={700}>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Código</Table.Th>
            <Table.Th>Nombre</Table.Th>
            <Table.Th>Estado</Table.Th>
            <Table.Th ta="right">Órdenes</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>{rows}</Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

interface DeleteButtonProps {
  machine: Machine;
  onConfirm: () => void;
}

// Pide confirmación en un Popover antes de borrar
function DeleteButton({ machine, onConfirm }: DeleteButtonProps) {
  const [opened, setOpened] = useState(false);
  const orders = machine._count.orders;

  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-end" withArrow shadow="md">
      <Popover.Target>
        <Button size="xs" variant="light" color="red" onClick={() => setOpened((o) => !o)}>
          Borrar
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="xs">
          <Text size="sm">¿Borrar la máquina {machine.code}?</Text>
          {orders > 0 && (
            <Text size="xs" c="dimmed">
              {orders} {orders === 1 ? 'orden se quedará' : 'órdenes se quedarán'} sin máquina.
            </Text>
          )}
          <Group gap="xs" justify="flex-end">
            <Button size="xs" variant="default" onClick={() => setOpened(false)}>
              Cancelar
            </Button>
            <Button
              size="xs"
              color="red"
              onClick={() => {
                setOpened(false);
                onConfirm();
              }}
            >
              Borrar
            </Button>
          </Group>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
