import { DonutChart } from '@mantine/charts';
import { Center } from '@mantine/core';
import type { DashboardStats } from '../../types/dashboard';
import { formatHours } from '../employees/formatHours';
import { STOP_REASON_CONFIG } from '../worklogs/stopReason';
import { ChartCard } from './ChartCard';

export function StopReasonsChart({ data }: { data: DashboardStats['stoppedMinutes'] }) {
  // Un motivo con 0 minutos no aporta porción al gráfico
  const chartData = data
    .filter(({ minutes }) => minutes > 0)
    .map(({ reason, minutes }) => ({
      name: STOP_REASON_CONFIG[reason].label,
      value: minutes,
      color: `${STOP_REASON_CONFIG[reason].color}.6`,
    }));

  return (
    <ChartCard title="Tiempo parado por motivo" isEmpty={chartData.length === 0}>
      <Center h={300}>
        <DonutChart
          size={220}
          thickness={36}
          data={chartData}
          withLabelsLine
          withLabels
          tooltipDataSource="segment"
          valueFormatter={(minutes) => formatHours(minutes / 60)}
        />
      </Center>
    </ChartCard>
  );
}
