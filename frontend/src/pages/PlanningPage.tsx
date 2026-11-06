import { useState } from 'react';
import {
  Alert,
  Anchor,
  Button,
  Center,
  Group,
  List,
  Loader,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';
import { GanttChart } from '../components/planning/GanttChart';
import { MachineQueue } from '../components/planning/MachineQueue';
import { PlannedStartModal } from '../components/planning/PlannedStartModal';
import { ganttTicks, ganttWindow, plantToday } from '../components/planning/planningTime';
import { usePlanning, useReorderQueue, useSetPlannedStart } from '../hooks/usePlanning';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { PLANNING_SPANS, setPlanningDay, setPlanningSpan, type PlanningSpan } from '../store/uiSlice';
import type { PlanningMachine, PlanningOrder } from '../types/planning';

// Cada solape una vez ("A y B", no también "B y A")
function overlapPairs(machines: PlanningMachine[]) {
  return machines.flatMap((machine) => {
    const codes = new Map(machine.orders.map((o) => [o.id, o.code]));
    return machine.orders.flatMap((order) =>
      order.overlapsWith
        .filter((otherId) => otherId > order.id)
        .map((otherId) => ({ key: `${order.id}-${otherId}`, text: `${machine.code}: ${order.code} y ${codes.get(otherId)}` })),
    );
  });
}

export function PlanningPage() {
  const dispatch = useAppDispatch();
  const planningDay = useAppSelector((state) => state.ui.planningDay);
  const span = useAppSelector((state) => state.ui.planningSpan);
  const { data, dataUpdatedAt, isPending, isError, error } = usePlanning();
  const reorder = useReorderQueue();
  const setPlannedStart = useSetPlannedStart();
  // Orden abierta en el modal de inicio previsto
  const [selected, setSelected] = useState<PlanningOrder | null>(null);

  if (isPending) {
    return (
      <Center py="xl">
        <Loader />
      </Center>
    );
  }
  if (isError) {
    return (
      <Alert color="red" title="No se pudo cargar la planificación">
        {error.message}
      </Alert>
    );
  }

  const { timeZone } = data;
  const day = planningDay ?? plantToday(timeZone);
  const overlaps = overlapPairs(data.machines);

  const savePlannedStart = (plannedStart: string | null) => {
    if (!selected) return;
    setPlannedStart.mutate({ id: selected.id, plannedStart }, { onSuccess: () => setSelected(null) });
  };

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Planificación</Title>
        <Group gap="xs">
          <DatePickerInput
            aria-label="Primer día"
            valueFormat="DD/MM/YYYY"
            value={dayjs(day).toDate()}
            onChange={(date) => dispatch(setPlanningDay(date ? dayjs(date).format('YYYY-MM-DD') : null))}
            w={130}
          />
          <Button variant="default" onClick={() => dispatch(setPlanningDay(null))}>
            Hoy
          </Button>
          <SegmentedControl
            value={String(span)}
            onChange={(value) => dispatch(setPlanningSpan(Number(value) as PlanningSpan))}
            data={PLANNING_SPANS.map((s) => ({ value: String(s), label: s === 1 ? '1 día' : `${s} días` }))}
          />
        </Group>
      </Group>

      {overlaps.length > 0 && (
        <Alert color="red" title={overlaps.length === 1 ? 'Hay 1 solape' : `Hay ${overlaps.length} solapes`}>
          <List size="sm">
            {overlaps.map((o) => (
              <List.Item key={o.key}>{o.text}</List.Item>
            ))}
          </List>
        </Alert>
      )}

      <Paper withBorder p="md">
        <GanttChart
          machines={data.machines}
          timeZone={timeZone}
          window={ganttWindow(day, span, timeZone)}
          ticks={ganttTicks(day, span, timeZone)}
          // Hora de la última carga: la misma con la que el backend calculó los fines
          now={dataUpdatedAt}
          onSelect={setSelected}
        />
        <Text size="xs" c="dimmed" mt="xs">
          Duración = piezas que faltan × ciclo ideal. Pulsa una orden para cambiar su inicio previsto. Horas de la
          planta ({timeZone}).
        </Text>
      </Paper>

      {data.withoutMachine.length > 0 && (
        <Alert color="gray">
          {data.withoutMachine.length} órdenes sin máquina no aparecen aquí.{' '}
          <Anchor component={Link} to="/orders" size="sm">
            Asígnalas en Órdenes
          </Anchor>
        </Alert>
      )}

      <div>
        <Title order={4}>Colas por máquina</Title>
        <Text size="sm" c="dimmed">
          Arrastra las órdenes (o usa las flechas) para cambiar el orden en que se fabrican.
        </Text>
      </div>
      <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }}>
        {data.machines.map((machine) => (
          <MachineQueue
            key={machine.id}
            machine={machine}
            timeZone={timeZone}
            onReorder={(orderIds) => reorder.mutate({ machineId: machine.id, orderIds })}
            onSelect={setSelected}
          />
        ))}
      </SimpleGrid>

      <PlannedStartModal
        order={selected}
        timeZone={timeZone}
        loading={setPlannedStart.isPending}
        onClose={() => setSelected(null)}
        onSave={savePlannedStart}
      />
    </Stack>
  );
}
