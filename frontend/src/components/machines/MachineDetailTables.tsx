import type { ReactNode } from 'react';
import { Badge, Paper, Stack, Table, Text, Title } from '@mantine/core';
import type {
  MachineDetailOrder,
  MachineIncident,
  MachineMaintenance,
} from '../../types/machine';
import { formatHours } from '../employees/formatHours';
import { StatusBadge } from '../orders/StatusBadge';

const formatDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : '—';

// Uno abierto (endedAt null) dura hasta ahora
const hoursBetween = (start: string, end: string | null) =>
  ((end ? new Date(end) : new Date()).getTime() - new Date(start).getTime()) / 3_600_000;

function OpenBadge() {
  return (
    <Badge size="sm" variant="light" color="orange">
      En curso
    </Badge>
  );
}

function Section({ title, empty, children }: { title: string; empty: string | null; children: ReactNode }) {
  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="sm">
        <Title order={4}>{title}</Title>
        {empty ? (
          <Text c="dimmed" ta="center" py="md">
            {empty}
          </Text>
        ) : (
          <Table.ScrollContainer minWidth={600}>{children}</Table.ScrollContainer>
        )}
      </Stack>
    </Paper>
  );
}

export function MachineOrdersTable({ orders }: { orders: MachineDetailOrder[] }) {
  return (
    <Section title="Órdenes" empty={orders.length === 0 ? 'La máquina no tiene órdenes.' : null}>
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Orden</Table.Th>
            <Table.Th>Producto</Table.Th>
            <Table.Th>Estado</Table.Th>
            <Table.Th ta="right">Producido</Table.Th>
            <Table.Th>Empleado</Table.Th>
            <Table.Th>Inicio</Table.Th>
            <Table.Th>Fin</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {orders.map((order) => (
            <Table.Tr key={order.id}>
              <Table.Td>{order.code}</Table.Td>
              <Table.Td>{order.product}</Table.Td>
              <Table.Td>
                <StatusBadge status={order.status} />
              </Table.Td>
              <Table.Td ta="right">
                {order.producedQty} / {order.quantity}
              </Table.Td>
              <Table.Td>{order.assignedEmployee?.name ?? '—'}</Table.Td>
              <Table.Td>{formatDateTime(order.startedAt)}</Table.Td>
              <Table.Td>{formatDateTime(order.finishedAt)}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Section>
  );
}

export function MachineIncidentsTable({ incidents }: { incidents: MachineIncident[] }) {
  return (
    <Section
      title="Incidencias"
      empty={incidents.length === 0 ? 'Sin incidencias en el rango.' : null}
    >
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Fecha</Table.Th>
            <Table.Th>Orden</Table.Th>
            <Table.Th>Empleado</Table.Th>
            <Table.Th>Nota</Table.Th>
            <Table.Th ta="right">Mantenimiento</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {incidents.map((incident) => (
            <Table.Tr key={incident.id}>
              <Table.Td>{formatDateTime(incident.endedAt)}</Table.Td>
              <Table.Td>{incident.order.code}</Table.Td>
              <Table.Td>{incident.employee.name}</Table.Td>
              <Table.Td>{incident.note}</Table.Td>
              <Table.Td ta="right">
                {incident.maintenance === null ? (
                  '—'
                ) : incident.maintenance.endedAt === null ? (
                  <OpenBadge />
                ) : (
                  formatHours(hoursBetween(incident.maintenance.startedAt, incident.maintenance.endedAt))
                )}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Section>
  );
}

export function MachineMaintenancesTable({ maintenances }: { maintenances: MachineMaintenance[] }) {
  return (
    <Section
      title="Mantenimientos"
      empty={maintenances.length === 0 ? 'Sin mantenimientos en el rango.' : null}
    >
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Inicio</Table.Th>
            <Table.Th>Fin</Table.Th>
            <Table.Th ta="right">Duración</Table.Th>
            <Table.Th>Origen</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {maintenances.map((m) => (
            <Table.Tr key={m.id}>
              <Table.Td>{formatDateTime(m.startedAt)}</Table.Td>
              <Table.Td>{m.endedAt === null ? <OpenBadge /> : formatDateTime(m.endedAt)}</Table.Td>
              <Table.Td ta="right">{formatHours(hoursBetween(m.startedAt, m.endedAt))}</Table.Td>
              <Table.Td>
                {m.orderCode === null ? (
                  'Puesta a mano'
                ) : (
                  <Stack gap={2}>
                    <Text size="sm">Incidencia en {m.orderCode}</Text>
                    {m.note && (
                      <Text size="xs" c="dimmed">
                        {m.note}
                      </Text>
                    )}
                  </Stack>
                )}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Section>
  );
}
