import { Alert, Button, Center, Group, Loader, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { Link, useParams } from 'react-router-dom';
import { StatCard } from '../components/dashboard/StatCard';
import { formatHours } from '../components/employees/formatHours';
import {
  MachineIncidentsTable,
  MachineMaintenancesTable,
  MachineOrdersTable,
} from '../components/machines/MachineDetailTables';
import { MachineStatusBadge } from '../components/machines/MachineStatusBadge';
import { ReportRangePicker } from '../components/reports/ReportRangePicker';
import { useMachineDetail } from '../hooks/useMachines';
import { useAppSelector } from '../store/hooks';

export function MachineDetailPage() {
  const id = Number(useParams().id);
  const range = useAppSelector((state) => state.ui.reportRange);
  const { data: detail, isPending, isError, error } = useMachineDetail(id, range);

  let content;
  if (isPending) {
    content = (
      <Center py="xl">
        <Loader />
      </Center>
    );
  } else if (isError) {
    content = (
      <Alert color="red" title="No se pudo cargar la máquina">
        {error.message}
      </Alert>
    );
  } else {
    const { metrics } = detail;
    content = (
      <Stack>
        <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }}>
          <StatCard title="Horas trabajadas" value={formatHours(metrics.workedHours)} color="blue" />
          <StatCard
            title="Horas de mantenimiento"
            value={formatHours(metrics.maintenanceHours)}
            color="orange"
          />
          <StatCard title="Incidencias" value={metrics.failures} color="red" />
          <StatCard
            title="Tiempo medio entre averías"
            value={metrics.mtbfHours === null ? '—' : formatHours(metrics.mtbfHours)}
            color="teal"
          />
        </SimpleGrid>
        <Text size="xs" c="dimmed">
          Tiempo medio entre averías (MTBF) = horas trabajadas ÷ incidencias del rango. Los
          periodos abiertos cuentan hasta ahora.
        </Text>
        <MachineIncidentsTable incidents={detail.incidents} />
        <MachineMaintenancesTable maintenances={detail.maintenances} />
        <MachineOrdersTable orders={detail.orders} />
      </Stack>
    );
  }

  return (
    <Stack>
      <Group justify="space-between" align="flex-end">
        <Stack gap={4}>
          <Button component={Link} to="/machines" variant="subtle" size="compact-sm" w="fit-content">
            ← Máquinas
          </Button>
          <Group gap="sm">
            <Title order={2}>
              {detail ? `${detail.machine.code} · ${detail.machine.name}` : 'Máquina'}
            </Title>
            {detail && <MachineStatusBadge status={detail.machine.status} />}
          </Group>
        </Stack>
        <ReportRangePicker />
      </Group>
      {content}
    </Stack>
  );
}
