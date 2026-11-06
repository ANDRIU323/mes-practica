import { useState } from 'react';
import { Alert, Button, Center, Grid, Group, Loader, SegmentedControl, Stack, Text, Title } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import dayjs from 'dayjs';
import { OeeCard } from '../components/reports/OeeCard';
import { HoursByMachineChart } from '../components/reports/HoursByMachineChart';
import { StopReasonsChart } from '../components/reports/StopReasonsChart';
import { UnitsByEmployeeChart } from '../components/reports/UnitsByEmployeeChart';
import { CloseShiftModal } from '../components/shifts/CloseShiftModal';
import { ShiftSummaryCard } from '../components/shifts/ShiftSummaryCard';
import { SHIFT_TYPE_LABEL, shiftTimeRange } from '../components/shifts/shiftConfig';
import { openWorkLogsFromError, useCloseShift, useShiftReport, useShifts } from '../hooks/useShifts';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setShiftDay, setShiftType } from '../store/uiSlice';
import type { OpenWorkLog, ShiftType } from '../types/shift';

export function ShiftsPage() {
  const dispatch = useAppDispatch();
  const shiftDay = useAppSelector((state) => state.ui.shiftDay);
  const shiftType = useAppSelector((state) => state.ui.shiftType);
  const { data: list, isPending, isError, error } = useShifts(shiftDay);

  // Sin tipo elegido: el turno actual si se está viendo su día, si no el de mañana
  const selectedType: ShiftType =
    shiftType ?? (list && list.current.date === list.from ? list.current.type : 'MORNING');
  const shift = list?.shifts.find((s) => s.type === selectedType) ?? null;
  const report = useShiftReport(shift && shift.status !== 'UPCOMING' ? shift : null);

  const closeMutation = useCloseShift();
  // WorkLog abiertos del 409: mientras hay lista, el modal de confirmación está abierto
  const [pendingOpen, setPendingOpen] = useState<OpenWorkLog[] | null>(null);

  const closeShift = (force: boolean) => {
    if (!shift) return;
    closeMutation.mutate(
      { key: { date: shift.date, type: shift.type }, force },
      {
        onSuccess: () => setPendingOpen(null),
        onError: (err) => setPendingOpen(openWorkLogsFromError(err)),
      },
    );
  };

  if (isPending) {
    return (
      <Center py="xl">
        <Loader />
      </Center>
    );
  }
  if (isError) {
    return (
      <Alert color="red" title="No se pudieron cargar los turnos">
        {error.message}
      </Alert>
    );
  }

  let reportContent;
  if (shift?.status === 'UPCOMING') {
    reportContent = <Text c="dimmed">El turno aún no ha empezado</Text>;
  } else if (report.isPending) {
    reportContent = (
      <Center py="xl">
        <Loader />
      </Center>
    );
  } else if (report.isError) {
    reportContent = (
      <Alert color="red" title="No se pudo cargar el informe">
        {report.error.message}
      </Alert>
    );
  } else {
    const { stats, oee } = report.data;
    reportContent = (
      <Grid>
        <Grid.Col span={12}>
          <OeeCard data={oee} error={null} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <UnitsByEmployeeChart data={stats.employees} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <HoursByMachineChart data={stats.machines} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <StopReasonsChart data={stats.stoppedMinutes} />
        </Grid.Col>
      </Grid>
    );
  }

  return (
    <Stack>
      <Group justify="space-between" align="flex-end">
        <Title order={2}>Turnos</Title>
        <Group align="flex-end">
          {/* Un día de calendario, no un instante: se manda tal cual "YYYY-MM-DD" */}
          <DatePickerInput
            label="Día"
            value={dayjs(list.from).toDate()}
            onChange={(value) => value && dispatch(setShiftDay(dayjs(value).format('YYYY-MM-DD')))}
            valueFormat="DD/MM/YYYY"
            w={160}
          />
          <Button
            variant="default"
            onClick={() => {
              dispatch(setShiftDay(null));
              dispatch(setShiftType(null));
            }}
          >
            Turno actual
          </Button>
        </Group>
      </Group>

      <SegmentedControl
        value={selectedType}
        onChange={(value) => dispatch(setShiftType(value as ShiftType))}
        data={list.shifts.map((s) => ({
          value: s.type,
          label: `${SHIFT_TYPE_LABEL[s.type]} ${shiftTimeRange(s, list.timeZone)}`,
        }))}
      />

      {shift && (
        <ShiftSummaryCard
          shift={shift}
          timeZone={list.timeZone}
          openWorkLogs={shift.status === 'UPCOMING' ? undefined : report.data?.openWorkLogs}
          closing={closeMutation.isPending && pendingOpen === null}
          onClose={() => closeShift(false)}
        />
      )}

      {reportContent}

      <CloseShiftModal
        openWorkLogs={pendingOpen}
        timeZone={list.timeZone}
        loading={closeMutation.isPending}
        onClose={() => setPendingOpen(null)}
        onConfirm={() => closeShift(true)}
      />
    </Stack>
  );
}
