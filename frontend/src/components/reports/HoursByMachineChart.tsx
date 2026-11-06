import { BarChart } from '@mantine/charts';
import type { DashboardStats } from '../../types/dashboard';
import { ChartCard } from './ChartCard';

export function HoursByMachineChart({ data }: { data: DashboardStats['machines'] }) {
  const chartData = data.map(({ machine, hours }) => ({ name: machine.name, hours }));

  return (
    <ChartCard title="Horas por máquina" isEmpty={chartData.length === 0}>
      <BarChart
        h={300}
        data={chartData}
        dataKey="name"
        series={[{ name: 'hours', label: 'Horas', color: 'teal.6' }]}
        valueFormatter={(value) => `${value} h`}
      />
    </ChartCard>
  );
}
