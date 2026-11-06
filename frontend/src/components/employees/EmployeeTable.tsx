import { useState } from 'react';
import { Badge, Button, Group, Popover, Stack, Table, Text } from '@mantine/core';
import type { EmployeeWithTotals } from '../../types/employee';
import { formatHours } from './formatHours';
import { isEmployeeLocked } from './isEmployeeLocked';

interface EmployeeTableProps {
  employees: EmployeeWithTotals[];
  onSelect: (employee: EmployeeWithTotals) => void;
  onEdit: (employee: EmployeeWithTotals) => void;
  onSetPin: (employee: EmployeeWithTotals) => void;
  onDelete: (employee: EmployeeWithTotals) => void;
}

export function EmployeeTable({ employees, onSelect, onEdit, onSetPin, onDelete }: EmployeeTableProps) {
  const rows = employees.map((employee) => (
    <Table.Tr key={employee.id} onClick={() => onSelect(employee)} style={{ cursor: 'pointer' }}>
      <Table.Td>{employee.code}</Table.Td>
      <Table.Td>{employee.name}</Table.Td>
      <Table.Td>
        <Group gap={4} wrap="nowrap">
          <Badge color={employee.active ? 'green' : 'gray'} variant="light">
            {employee.active ? 'Activo' : 'Inactivo'}
          </Badge>
          {isEmployeeLocked(employee) && (
            <Badge color="red" variant="light">
              Bloqueado
            </Badge>
          )}
          {!employee.hasPin && (
            <Badge color="orange" variant="light">
              Sin PIN
            </Badge>
          )}
        </Group>
      </Table.Td>
      <Table.Td ta="right">{formatHours(employee.totalHours)}</Table.Td>
      <Table.Td ta="right">{employee.totalUnits}</Table.Td>
      {/* Los clics en los botones no deben abrir el detalle de la fila */}
      <Table.Td onClick={(e) => e.stopPropagation()}>
        <Group gap="xs" justify="flex-end">
          <Button size="xs" variant="light" onClick={() => onEdit(employee)}>
            Editar
          </Button>
          <Button size="xs" variant="light" color="gray" onClick={() => onSetPin(employee)}>
            PIN
          </Button>
          <DeleteButton employee={employee} onConfirm={() => onDelete(employee)} />
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
            <Table.Th ta="right">Horas</Table.Th>
            <Table.Th ta="right">Unidades</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>{rows}</Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

interface DeleteButtonProps {
  employee: EmployeeWithTotals;
  onConfirm: () => void;
}

// Pide confirmación en un Popover antes de borrar
function DeleteButton({ employee, onConfirm }: DeleteButtonProps) {
  const [opened, setOpened] = useState(false);

  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-end" withArrow shadow="md">
      <Popover.Target>
        <Button size="xs" variant="light" color="red" onClick={() => setOpened((o) => !o)}>
          Borrar
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="xs">
          <Text size="sm">¿Borrar el empleado {employee.code}?</Text>
          <Text size="xs" c="dimmed">
            Si tiene registros de trabajo no se podrá borrar: desactívalo.
          </Text>
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
