import { Button, Card, Group, Progress, Stack, Text, Title } from '@mantine/core';
import type { ShopfloorOrder } from '../../types/shopfloor';
import { StatusBadge } from '../orders/StatusBadge';

interface ShopfloorOrderCardProps {
  order: ShopfloorOrder;
  // true si el empleado ya tiene otro trabajo abierto
  disabled: boolean;
  loading: boolean;
  onStart: () => void;
}

export function ShopfloorOrderCard({ order, disabled, loading, onStart }: ShopfloorOrderCardProps) {
  const percent = Math.min(100, Math.round((order.producedQty / order.quantity) * 100));

  return (
    <Card withBorder radius="lg" padding="lg">
      <Group justify="space-between" align="center" wrap="wrap" gap="md">
        <Stack gap={4} style={{ flex: 1, minWidth: 220 }}>
          <Group gap="sm">
            <Title order={3}>{order.code}</Title>
            <StatusBadge status={order.status} />
          </Group>
          <Text size="lg">{order.product}</Text>
          {order.machine && (
            <Text c="dimmed">
              {order.machine.code} · {order.machine.name}
            </Text>
          )}
          <Progress value={percent} size="md" radius="xl" mt={4} />
          <Text size="sm" c="dimmed">
            {order.producedQty} de {order.quantity} unidades
          </Text>
        </Stack>

        <Button size="xl" h={64} miw={180} color="green" disabled={disabled} loading={loading} onClick={onStart}>
          Iniciar
        </Button>
      </Group>
    </Card>
  );
}
