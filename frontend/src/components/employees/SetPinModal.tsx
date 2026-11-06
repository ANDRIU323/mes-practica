import { useState } from 'react';
import { Button, Group, Input, Modal, PinInput, Stack, Text } from '@mantine/core';
import { useSetEmployeePin } from '../../hooks/useEmployees';
import type { EmployeeWithTotals } from '../../types/employee';
import { isEmployeeLocked } from './isEmployeeLocked';

interface SetPinModalProps {
  // null = cerrado
  employee: EmployeeWithTotals | null;
  onClose: () => void;
}

export function SetPinModal({ employee, onClose }: SetPinModalProps) {
  const setPin = useSetEmployeePin();
  const [pin, setPinValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setPinValue('');
    setError(null);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(pin)) {
      setError('El PIN son 4 dígitos');
      return;
    }
    setPin.mutate({ id: employee!.id, pin }, { onSuccess: close });
  };

  return (
    <Modal opened={employee !== null} onClose={close} title={`PIN de ${employee?.code ?? ''}`}>
      <form onSubmit={handleSubmit}>
        <Stack>
          {employee && isEmployeeLocked(employee) && (
            <Text size="sm" c="orange">
              Está bloqueado por intentos fallidos: con el PIN nuevo vuelve a poder entrar.
            </Text>
          )}
          <Input.Wrapper label="PIN nuevo" withAsterisk error={error}>
            <PinInput
              length={4}
              type="number"
              oneTimeCode={false}
              aria-label="PIN nuevo"
              value={pin}
              onChange={(value) => {
                setPinValue(value);
                setError(null);
              }}
              error={!!error}
              mt={4}
            />
          </Input.Wrapper>
          <Text size="xs" c="dimmed">
            Díselo al empleado: después no se puede volver a ver.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={close}>
              Cancelar
            </Button>
            <Button type="submit" loading={setPin.isPending}>
              Guardar
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
