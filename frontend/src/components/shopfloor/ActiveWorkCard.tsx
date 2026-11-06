import { Badge, Button, Card, Group, Progress, Stack, Text, Title } from '@mantine/core';
import type { ActiveShopfloorOrder } from '../../types/shopfloor';
import { ElapsedTimer } from './ElapsedTimer';

interface ActiveWorkCardProps {
  order: ActiveShopfloorOrder;
  onStop: () => void;
}

// Tarjeta destacada del trabajo en curso del empleado
export function ActiveWorkCard({ order, onStop }: ActiveWorkCardProps) {
  const percent = Math.min(100, Math.round((order.producedQty / order.quantity) * 100));
  const startedAt = new Date(order.openWorkLog.startedAt).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Card withBorder shadow="md" radius="lg" padding="xl" bd="3px solid var(--mantine-color-blue-filled)">
      <Stack gap="md">
        <Group justify="space-between" wrap="nowrap">
          <div>
            <Title order={2}>{order.code}</Title>
            <Text size="xl">{order.product}</Text>
            {order.machine && (
              <Text c="dimmed">
                {order.machine.code} · {order.machine.name}
              </Text>
            )}
          </div>
          <Badge size="xl" variant="dot">
            Trabajando
          </Badge>
        </Group>

        <Stack gap={0} align="center">
          <ElapsedTimer since={order.openWorkLog.startedAt} fz={72} fw={700} lh={1.1} />
          <Text c="dimmed">Desde las {startedAt}</Text>
        </Stack>

        <Stack gap={4}>
          <Progress value={percent} size="lg" radius="xl" />
          <Text size="sm" c="dimmed">
            Llevan {order.producedQty} de {order.quantity} unidades ({percent}%)
          </Text>
        </Stack>

        <Button size="xl" h={72} color="red" fullWidth onClick={onStop}>
          Finalizar
        </Button>
      </Stack>
    </Card>
  );
}
