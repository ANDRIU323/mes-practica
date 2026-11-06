import { Badge } from '@mantine/core';
import type { MachineStatus } from '../../types/machine';
import { MACHINE_STATUS_CONFIG } from './machineStatus';

interface MachineStatusBadgeProps {
  status: MachineStatus;
}

export function MachineStatusBadge({ status }: MachineStatusBadgeProps) {
  const { label, color } = MACHINE_STATUS_CONFIG[status];
  return (
    <Badge color={color} variant="light">
      {label}
    </Badge>
  );
}
