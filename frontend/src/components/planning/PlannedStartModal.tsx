import { useState } from 'react';
import { Alert, Button, Group, Modal, Stack, Text } from '@mantine/core';
import { DatesProvider, DateTimePicker } from '@mantine/dates';
import type { PlanningOrder } from '../../types/planning';
import { formatDuration, remainingMs } from './planningTime';

interface PlannedStartModalProps {
  // null = cerrado
  order: PlanningOrder | null;
  timeZone: string;
  loading: boolean;
  onClose: () => void;
  onSave: (plannedStart: string | null) => void;
}

export function PlannedStartModal({ order, timeZone, loading, onClose, onSave }: PlannedStartModalProps) {
  return (
    <Modal opened={order !== null} onClose={onClose} title={order ? `Inicio previsto · ${order.code}` : ''}>
      {/* key: cada orden empieza con su propio valor, no con el de la anterior */}
      {order && (
        <PlannedStartForm key={order.id} order={order} timeZone={timeZone} loading={loading} onCancel={onClose} onSave={onSave} />
      )}
    </Modal>
  );
}

function PlannedStartForm({
  order,
  timeZone,
  loading,
  onCancel,
  onSave,
}: Omit<PlannedStartModalProps, 'order' | 'onClose'> & { order: PlanningOrder; onCancel: () => void }) {
  const [value, setValue] = useState<Date | null>(order.plannedStart ? new Date(order.plannedStart) : null);
  const remaining = remainingMs(order);

  return (
    <Stack>
      <Text size="sm">
        {order.product} · faltan {Math.max(order.quantity - order.producedQty, 0)} de {order.quantity} uds
      </Text>
      {order.status === 'IN_PROGRESS' && (
        <Alert color="blue">Ya está en curso: el Gantt la pinta desde su inicio real.</Alert>
      )}
      {/* Con timezone, el selector muestra y devuelve la hora de la planta, no la del navegador.
          Un DatesProvider anidado sustituye los ajustes del de main.tsx: se repiten locale y semana */}
      <DatesProvider settings={{ locale: 'es', firstDayOfWeek: 1, timezone: timeZone }}>
        <DateTimePicker
          label="Inicio previsto"
          description={`Hora de la planta (${timeZone})`}
          placeholder="Sin planificar"
          valueFormat="DD/MM/YYYY HH:mm"
          clearable
          value={value}
          onChange={setValue}
        />
      </DatesProvider>
      <Text size="sm" c="dimmed">
        Duración estimada:{' '}
        {remaining === null ? 'sin ciclo ideal no se puede estimar' : formatDuration(remaining)}
      </Text>
      <Group justify="flex-end">
        <Button variant="default" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button loading={loading} onClick={() => onSave(value ? value.toISOString() : null)}>
          Guardar
        </Button>
      </Group>
    </Stack>
  );
}
