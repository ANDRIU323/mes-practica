import { useState } from 'react';
import { Alert, AppShell, Button, Center, Container, Group, Loader, Stack, Text, Title } from '@mantine/core';

import { ColorSchemeToggle } from '../components/layout/ColorSchemeToggle';
import { ActiveWorkCard } from '../components/shopfloor/ActiveWorkCard';
import { ShopfloorOrderCard } from '../components/shopfloor/ShopfloorOrderCard';
import { StopWorkModal } from '../components/shopfloor/StopWorkModal';
import { useLogout } from '../hooks/useAuth';
import { useShopfloorOrders, useStartWork, useStopWork } from '../hooks/useShopfloor';
import { useAppSelector } from '../store/hooks';
import { selectCurrentUser } from '../store/authSlice';
import type { ActiveShopfloorOrder } from '../types/shopfloor';

// Pantalla táctil de planta: el empleado ve sus órdenes, inicia y finaliza su trabajo
export function ShopfloorPage() {
  const user = useAppSelector(selectCurrentUser);
  const logout = useLogout();
  const { data: orders, isPending, isError, error } = useShopfloorOrders();
  const startWork = useStartWork();
  const stopWork = useStopWork();
  const [stopOpened, setStopOpened] = useState(false);
  const closeStop = () => setStopOpened(false);

  const active = orders?.find((order): order is ActiveShopfloorOrder => order.openWorkLog !== null) ?? null;
  const others = orders?.filter((order) => order !== active) ?? [];

  let content;
  if (isPending) {
    content = (
      <Center py="xl">
        <Loader size="lg" />
      </Center>
    );
  } else if (isError) {
    content = (
      <Alert color="red" title="No se pudieron cargar tus órdenes">
        {error.message}
      </Alert>
    );
  } else {
    content = (
      <Stack gap="lg">
        {active && <ActiveWorkCard order={active} onStop={() => setStopOpened(true)} />}

        <Stack gap="sm">
          <Title order={3}>{active ? 'Otras órdenes' : 'Mis órdenes'}</Title>
          {active && others.length > 0 && (
            <Text c="dimmed">Finaliza el trabajo actual para iniciar otra orden.</Text>
          )}
          {others.length === 0 ? (
            <Text c="dimmed" size="lg" ta="center" py="xl">
              {active ? 'No tienes más órdenes asignadas.' : 'No tienes órdenes asignadas.'}
            </Text>
          ) : (
            others.map((order) => (
              <ShopfloorOrderCard
                key={order.id}
                order={order}
                disabled={active !== null || startWork.isPending}
                loading={startWork.isPending && startWork.variables === order.id}
                onStart={() => startWork.mutate(order.id)}
              />
            ))
          )}
        </Stack>
      </Stack>
    );
  }

  return (
    <AppShell header={{ height: 80 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <div>
            <Text size="sm" c="dimmed">
              Planta{user?.role === 'EMPLOYEE' && ` · ${user.code}`}
            </Text>
            <Title order={2} lineClamp={1}>
              {user?.name}
            </Title>
          </div>
          <Group gap="sm" wrap="nowrap">
            <ColorSchemeToggle size={50} />
            <Button size="lg" variant="default" onClick={logout}>
              Cerrar sesión
            </Button>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        <Container size="md" px={0}>
          {content}
        </Container>
      </AppShell.Main>

      <StopWorkModal
        order={active}
        opened={stopOpened && active !== null}
        loading={stopWork.isPending}
        onClose={closeStop}
        onSubmit={(data) =>
          active &&
          stopWork.mutate({ workLogId: active.openWorkLog.id, data }, { onSuccess: closeStop })
        }
      />
    </AppShell>
  );
}
