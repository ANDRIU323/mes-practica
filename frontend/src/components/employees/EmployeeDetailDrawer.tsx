import { Alert, Badge, Center, Drawer, Group, Loader, Stack, Table, Text, Title } from '@mantine/core';
import { useEmployeeStats } from '../../hooks/useEmployees';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setSelectedEmployeeId } from '../../store/uiSlice';
import type { EmployeeWorkLog } from '../../types/employee';
import { StatCard } from '../dashboard/StatCard';
import { STOP_REASON_CONFIG } from '../worklogs/stopReason';
import { formatHours } from './formatHours';

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });

function StopReasonCell({ log }: { log: EmployeeWorkLog }) {
  if (log.stopReason === null) {
    return (
      <Badge size="sm" variant="light">
        En curso
      </Badge>
    );
  }
  const { label, color } = STOP_REASON_CONFIG[log.stopReason];
  return (
    <Stack gap={2}>
      <Badge size="sm" variant="light" color={color}>
        {label}
      </Badge>
      {log.note && (
        <Text size="xs" c="dimmed">
          {log.note}
        </Text>
      )}
    </Stack>
  );
}

export function EmployeeDetailDrawer() {
  const dispatch = useAppDispatch();
  const employeeId = useAppSelector((state) => state.ui.selectedEmployeeId);
  const { data: stats, isPending, isError, error } = useEmployeeStats(employeeId);

  const close = () => dispatch(setSelectedEmployeeId(null));

  let content;
  if (isPending) {
    content = (
      <Center py="xl">
        <Loader />
      </Center>
    );
  } else if (isError) {
    content = (
      <Alert color="red" title="No se pudo cargar el detalle">
        {error.message}
      </Alert>
    );
  } else {
    content = (
      <Stack>
        <Group grow>
          <StatCard title="Horas trabajadas" value={formatHours(stats.totalHours)} color="blue" />
          <StatCard title="Unidades fabricadas" value={stats.totalUnits} color="teal" />
        </Group>

        {stats.orders.length === 0 ? (
          <Text c="dimmed" ta="center" py="md">
            Todavía no ha trabajado en ninguna orden.
          </Text>
        ) : (
          <>
            <Title order={5}>Por orden</Title>
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Orden</Table.Th>
                  <Table.Th>Producto</Table.Th>
                  <Table.Th ta="right">Tiempo</Table.Th>
                  <Table.Th ta="right">Unidades</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {stats.orders.map((order) => (
                  <Table.Tr key={order.orderId}>
                    <Table.Td>
                      <Group gap={6} wrap="nowrap">
                        {order.code}
                        {order.open && (
                          <Badge size="xs" variant="light">
                            En curso
                          </Badge>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td>{order.product}</Table.Td>
                    <Table.Td ta="right">{formatHours(order.hours)}</Table.Td>
                    <Table.Td ta="right">{order.units}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>

            <Title order={5}>Registros de trabajo</Title>
            <Table striped verticalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Orden</Table.Th>
                  <Table.Th>Inicio</Table.Th>
                  <Table.Th ta="right">Tiempo</Table.Th>
                  <Table.Th ta="right">Unidades</Table.Th>
                  <Table.Th>Motivo</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {stats.workLogs.map((log) => (
                  <Table.Tr key={log.id}>
                    <Table.Td>{log.orderCode}</Table.Td>
                    <Table.Td>{formatDateTime(log.startedAt)}</Table.Td>
                    <Table.Td ta="right">{formatHours(log.hours)}</Table.Td>
                    <Table.Td ta="right">{log.endedAt === null ? '—' : log.producedQty}</Table.Td>
                    <Table.Td>
                      <StopReasonCell log={log} />
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </>
        )}
      </Stack>
    );
  }

  return (
    <Drawer
      opened={employeeId !== null}
      onClose={close}
      position="right"
      size="lg"
      title={stats ? `${stats.employee.code} · ${stats.employee.name}` : 'Empleado'}
    >
      {content}
    </Drawer>
  );
}
