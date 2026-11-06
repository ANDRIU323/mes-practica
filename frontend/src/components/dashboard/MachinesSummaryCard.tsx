import { Center, Group, Loader, Paper, Stack, Text, Title } from '@mantine/core';
import { useMachines } from '../../hooks/useMachines';
import { MACHINE_STATUS_CONFIG } from '../machines/machineStatus';
import { MachineStatusBadge } from '../machines/MachineStatusBadge';
import type { MachineStatus } from '../../types/machine';

const MACHINE_STATUSES = Object.keys(MACHINE_STATUS_CONFIG) as MachineStatus[];

export function MachinesSummaryCard() {
  const { data: machines, isPending, isError, error } = useMachines();

  let content;
  if (isPending) {
    content = (
      <Center py="md">
        <Loader size="sm" />
      </Center>
    );
  } else if (isError) {
    content = (
      <Text c="red" size="sm">
        {error.message}
      </Text>
    );
  } else {
    content = (
      <Stack gap="sm">
        {MACHINE_STATUSES.map((status) => (
          <Group key={status} justify="space-between">
            <MachineStatusBadge status={status} />
            <Text fw={700}>{machines.filter((m) => m.status === status).length}</Text>
          </Group>
        ))}
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Total
          </Text>
          <Text fw={700}>{machines.length}</Text>
        </Group>
      </Stack>
    );
  }

  return (
    <Paper withBorder radius="md" p="md" h="100%">
      <Title order={4} mb="md">
        Máquinas
      </Title>
      {content}
    </Paper>
  );
}
