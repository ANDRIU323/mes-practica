import { useState, type DragEvent } from 'react';
import { ActionIcon, Anchor, Badge, Box, Card, Group, Paper, Stack, Text } from '@mantine/core';
import type { PlanningMachine, PlanningOrder } from '../../types/planning';
import { StatusBadge } from '../orders/StatusBadge';
import { formatPlantDateTime } from '../shifts/shiftConfig';
import { moveItem } from './planningTime';

interface MachineQueueProps {
  machine: PlanningMachine;
  timeZone: string;
  onReorder: (orderIds: number[]) => void;
  onSelect: (order: PlanningOrder) => void;
}

function estimateText(order: PlanningOrder, timeZone: string) {
  if (order.cycleTimeSec === null) return 'Sin ciclo ideal: no se puede estimar';
  if (!order.estimatedStart || !order.estimatedEnd) return 'Sin inicio previsto';
  return `${formatPlantDateTime(order.estimatedStart, timeZone)} → ${formatPlantDateTime(order.estimatedEnd, timeZone)}`;
}

// Cola de una máquina: se reordena arrastrando (HTML5 drag and drop) o con las flechas,
// que también sirven con teclado. Solo acepta soltar órdenes de esta misma cola
export function MachineQueue({ machine, timeZone, onReorder, onSelect }: MachineQueueProps) {
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [overId, setOverId] = useState<number | null>(null);
  const ids = machine.orders.map((o) => o.id);

  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= ids.length) return;
    onReorder(moveItem(ids, from, to));
  };

  const endDrag = () => {
    setDraggedId(null);
    setOverId(null);
  };

  const handleDrop = (event: DragEvent, index: number) => {
    event.preventDefault();
    if (draggedId !== null) move(ids.indexOf(draggedId), index);
    endDrag();
  };

  return (
    <Card withBorder>
      <Group justify="space-between" mb="sm" wrap="nowrap">
        <Text fw={500} truncate>
          {machine.code} · {machine.name}
        </Text>
        <Badge variant="light" color="gray">
          {machine.orders.length}
        </Badge>
      </Group>

      {machine.orders.length === 0 ? (
        <Text size="sm" c="dimmed">
          Sin órdenes pendientes
        </Text>
      ) : (
        <Stack gap={6}>
          {machine.orders.map((order, index) => (
            <Paper
              key={order.id}
              withBorder
              p="xs"
              draggable
              onDragStart={(event) => {
                // Firefox no empieza a arrastrar sin datos
                event.dataTransfer.setData('text/plain', String(order.id));
                event.dataTransfer.effectAllowed = 'move';
                setDraggedId(order.id);
              }}
              // preventDefault en dragover = "aquí se puede soltar"
              onDragOver={(event) => {
                if (draggedId === null) return;
                event.preventDefault();
                setOverId(order.id);
              }}
              onDrop={(event) => handleDrop(event, index)}
              onDragEnd={endDrag}
              style={{
                cursor: 'grab',
                opacity: draggedId === order.id ? 0.5 : 1,
                borderColor:
                  overId === order.id && draggedId !== order.id ? 'var(--mantine-primary-color-filled)' : undefined,
              }}
            >
              <Group gap="xs" wrap="nowrap">
                <Text c="dimmed" aria-hidden>
                  ⠿
                </Text>
                <Text size="sm" c="dimmed" w={18}>
                  {index + 1}
                </Text>
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Group gap={6}>
                    <Anchor component="button" type="button" size="sm" fw={500} onClick={() => onSelect(order)}>
                      {order.code}
                    </Anchor>
                    <StatusBadge status={order.status} />
                    {order.overlapsWith.length > 0 && (
                      <Badge color="red" variant="filled">
                        Solape
                      </Badge>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed" truncate>
                    {order.product} · {estimateText(order, timeZone)}
                  </Text>
                </Box>
                <ActionIcon.Group>
                  <ActionIcon
                    variant="default"
                    size="sm"
                    aria-label={`Subir ${order.code}`}
                    disabled={index === 0}
                    onClick={() => move(index, index - 1)}
                  >
                    ↑
                  </ActionIcon>
                  <ActionIcon
                    variant="default"
                    size="sm"
                    aria-label={`Bajar ${order.code}`}
                    disabled={index === ids.length - 1}
                    onClick={() => move(index, index + 1)}
                  >
                    ↓
                  </ActionIcon>
                </ActionIcon.Group>
              </Group>
            </Paper>
          ))}
        </Stack>
      )}
    </Card>
  );
}
