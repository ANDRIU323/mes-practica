import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import type { OpenWorkLog } from '../../types/shift';
import { OpenWorkLogsList } from './OpenWorkLogsList';

interface CloseShiftModalProps {
  // Los que devolvió el 409; null = modal cerrado
  openWorkLogs: OpenWorkLog[] | null;
  timeZone: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function CloseShiftModal({ openWorkLogs, timeZone, loading, onClose, onConfirm }: CloseShiftModalProps) {
  return (
    <Modal opened={openWorkLogs !== null} onClose={onClose} title="Quedan registros abiertos" centered>
      {openWorkLogs && (
        <Stack>
          <Text size="sm">
            Estos empleados no han finalizado su trabajo. Si cierras el turno, sus registros
            seguirán abiertos hasta que los finalicen desde planta.
          </Text>
          <OpenWorkLogsList workLogs={openWorkLogs} timeZone={timeZone} />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancelar
            </Button>
            <Button color="yellow" onClick={onConfirm} loading={loading}>
              Cerrar igualmente
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
