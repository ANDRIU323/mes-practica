import { Badge } from '@mantine/core';
import type { OrderStatus } from '../../types/order';
import { ORDER_STATUS_CONFIG } from './orderStatus';

interface StatusBadgeProps {
  status: OrderStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const { label, color } = ORDER_STATUS_CONFIG[status];
  return (
    <Badge color={color} variant="light">
      {label}
    </Badge>
  );
}
