import { BarChart } from '@mantine/charts';
import { Paper, Title } from '@mantine/core';
import type { OrderStatusCount } from '../../api/orders';
import { ORDER_STATUS_CONFIG } from '../orders/orderStatus';

interface OrdersByStatusChartProps {
  data: OrderStatusCount[];
}

export function OrdersByStatusChart({ data }: OrdersByStatusChartProps) {
  // BarChart usa la clave `color` de cada fila para pintar esa barra
  const chartData = data.map(({ status, count }) => ({
    label: ORDER_STATUS_CONFIG[status].label,
    count,
    color: ORDER_STATUS_CONFIG[status].color,
  }));

  return (
    <Paper withBorder radius="md" p="md">
      <Title order={4} mb="md">
        Órdenes por estado
      </Title>
      <BarChart
        h={300}
        data={chartData}
        dataKey="label"
        series={[{ name: 'count', label: 'Órdenes' }]}
        yAxisProps={{ allowDecimals: false }}
      />
    </Paper>
  );
}
