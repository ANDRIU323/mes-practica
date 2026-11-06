import { BarChart } from '@mantine/charts';
import type { DashboardStats } from '../../types/dashboard';
import { ChartCard } from './ChartCard';

export function UnitsByEmployeeChart({ data }: { data: DashboardStats['employees'] }) {
  const chartData = data.map(({ employee, units }) => ({ name: employee.name, units }));

  return (
    <ChartCard title="Unidades por empleado" isEmpty={chartData.length === 0}>
      <BarChart
        h={300}
        data={chartData}
        dataKey="name"
        series={[{ name: 'units', label: 'Unidades', color: 'blue.6' }]}
        yAxisProps={{ allowDecimals: false }}
      />
    </ChartCard>
  );
}
