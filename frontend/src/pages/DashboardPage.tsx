import { Alert, Center, Grid, Loader, SimpleGrid, Stack, Title } from '@mantine/core';
import { IncidentsCard } from '../components/dashboard/IncidentsCard';
import { LiveWorkCard } from '../components/dashboard/LiveWorkCard';
import { MachinesSummaryCard } from '../components/dashboard/MachinesSummaryCard';
import { OrdersByStatusChart } from '../components/dashboard/OrdersByStatusChart';
import { StatCard } from '../components/dashboard/StatCard';
import { ORDER_STATUS_CONFIG, ORDER_STATUSES } from '../components/orders/orderStatus';
import { useNavigate } from 'react-router-dom';
import { useOrdersSummary } from '../hooks/useOrders';
import { useAppDispatch } from '../store/hooks';
import { setOrderStatusFilter } from '../store/uiSlice';
import type { OrderStatus } from '../types/order';

export function DashboardPage() {
  const { data: summary, isPending, isError, error } = useOrdersSummary();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const showOrdersWithStatus = (status: OrderStatus) => {
    dispatch(setOrderStatusFilter(status));
    navigate('/orders');
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
      <Alert color="red" title="No se pudo cargar el resumen de órdenes">
        {error.message}
      </Alert>
    );
  } else {
    // El backend omite los estados sin órdenes: se rellenan con 0
    const stats = ORDER_STATUSES.map((status) => ({
      status,
      count: summary.find((s) => s.status === status)?.count ?? 0,
    }));
    content = (
      <>
        <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }}>
          {stats.map(({ status, count }) => (
            <StatCard
              key={status}
              title={ORDER_STATUS_CONFIG[status].label}
              value={count}
              color={ORDER_STATUS_CONFIG[status].color}
              onClick={() => showOrdersWithStatus(status)}
            />
          ))}
        </SimpleGrid>
        <Grid>
          <Grid.Col span={{ base: 12, md: 8 }}>
            <OrdersByStatusChart data={stats} />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 4 }}>
            <MachinesSummaryCard />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <LiveWorkCard />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <IncidentsCard />
          </Grid.Col>
        </Grid>
      </>
    );
  }

  return (
    <Stack>
      <Title order={2}>Dashboard</Title>
      {content}
    </Stack>
  );
}
