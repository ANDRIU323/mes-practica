import { Alert, Button, Center, Grid, Group, Loader, Stack, Title } from '@mantine/core';
import { HoursByMachineChart } from '../components/reports/HoursByMachineChart';
import { OeeCard } from '../components/reports/OeeCard';
import { ReportRangePicker } from '../components/reports/ReportRangePicker';
import { StopReasonsChart } from '../components/reports/StopReasonsChart';
import { UnitsByEmployeeChart } from '../components/reports/UnitsByEmployeeChart';
import { downloadCsv, statsToCsv } from '../components/reports/statsCsv';
import { useDashboardOee, useDashboardStats } from '../hooks/useDashboard';
import { useAppSelector } from '../store/hooks';

export function ReportsPage() {
  const range = useAppSelector((state) => state.ui.reportRange);
  const { data: stats, isPending, isError, error, isFetching } = useDashboardStats(range);
  // Consulta aparte: la tarjeta muestra su propia carga y su error sin tapar los gráficos
  const oee = useDashboardOee(range);

  const exportCsv = () => {
    if (!stats) return;
    downloadCsv(`informe_${range.from}_${range.to}.csv`, statsToCsv(stats));
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
      <Alert color="red" title="No se pudo cargar el informe">
        {error.message}
      </Alert>
    );
  } else {
    content = (
      <Grid>
        <Grid.Col span={12}>
          <OeeCard data={oee.data} error={oee.error} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <UnitsByEmployeeChart data={stats.employees} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <HoursByMachineChart data={stats.machines} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <StopReasonsChart data={stats.stoppedMinutes} />
        </Grid.Col>
      </Grid>
    );
  }

  return (
    <Stack>
      <Group justify="space-between" align="flex-end">
        <Title order={2}>Informes</Title>
        <Group align="flex-end">
          <ReportRangePicker />
          <Button onClick={exportCsv} disabled={!stats} loading={isFetching}>
            Exportar CSV
          </Button>
        </Group>
      </Group>
      {content}
    </Stack>
  );
}
