import { Group, Stack, Text } from '@mantine/core';
import type { OpenWorkLog } from '../../types/shift';
import { formatPlantDateTime } from './shiftConfig';

// Compartida por el aviso del informe y el modal de cerrar turno
export function OpenWorkLogsList({ workLogs, timeZone }: { workLogs: OpenWorkLog[]; timeZone: string }) {
  return (
    <Stack gap="xs">
      {workLogs.map((log) => (
        <Group key={log.id} justify="space-between" wrap="nowrap">
          <div>
            <Text size="sm" fw={600}>
              {log.employee.name}
            </Text>
            <Text size="xs" c="dimmed">
              {log.order.code}
              {log.machine && ` · ${log.machine.name}`}
            </Text>
          </div>
          <Text size="sm">desde {formatPlantDateTime(log.startedAt, timeZone)}</Text>
        </Group>
      ))}
    </Stack>
  );
}
