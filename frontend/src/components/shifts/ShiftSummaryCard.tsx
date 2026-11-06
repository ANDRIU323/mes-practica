import { Alert, Badge, Button, Group, Paper, Stack, Text, Title } from '@mantine/core';
import dayjs from 'dayjs';
import type { OpenWorkLog, Shift } from '../../types/shift';
import { OpenWorkLogsList } from './OpenWorkLogsList';
import {
  SHIFT_STATUS_CONFIG,
  SHIFT_TYPE_LABEL,
  formatPlantDateTime,
  shiftDurationHours,
  shiftTimeRange,
} from './shiftConfig';

interface ShiftSummaryCardProps {
  shift: Shift;
  timeZone: string;
  // undefined mientras carga el informe (o si el turno no ha empezado)
  openWorkLogs: OpenWorkLog[] | undefined;
  closing: boolean;
  onClose: () => void;
}

export function ShiftSummaryCard({ shift, timeZone, openWorkLogs, closing, onClose }: ShiftSummaryCardProps) {
  const status = SHIFT_STATUS_CONFIG[shift.status];
  const hours = shiftDurationHours(shift);
  const canClose = shift.status === 'ACTIVE' || shift.status === 'ENDED';

  return (
    <Paper withBorder radius="md" p="md">
      <Group justify="space-between" align="flex-start">
        <Stack gap={4}>
          <Group gap="sm">
            {/* `date` es un día de calendario: dayjs lo lee como medianoche local y no cambia de día */}
            <Title order={4}>
              {SHIFT_TYPE_LABEL[shift.type]} · {dayjs(shift.date).format('DD/MM/YYYY')}
            </Title>
            <Badge color={status.color}>{status.label}</Badge>
          </Group>
          <Text size="sm" c="dimmed">
            {shiftTimeRange(shift, timeZone)} ({timeZone})
            {hours !== 8 && ` · ${hours} h por el cambio de hora`}
          </Text>
          {shift.closedAt && (
            <Text size="sm">
              Cerrado el {formatPlantDateTime(shift.closedAt, timeZone)}
              {shift.closedBy && ` por ${shift.closedBy.name}`}
            </Text>
          )}
        </Stack>
        {canClose && (
          <Button onClick={onClose} loading={closing}>
            Cerrar turno
          </Button>
        )}
      </Group>

      {openWorkLogs && openWorkLogs.length > 0 && (
        <Alert color="yellow" title="Registros de trabajo abiertos" mt="md">
          <OpenWorkLogsList workLogs={openWorkLogs} timeZone={timeZone} />
        </Alert>
      )}
    </Paper>
  );
}
