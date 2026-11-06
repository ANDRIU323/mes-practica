import { Button, Center, Group, Loader, Paper, Stack, Text, Title } from '@mantine/core';
import { useIncidents } from '../../hooks/useDashboard';
import { useUpdateMachine } from '../../hooks/useMachines';
import { MachineStatusBadge } from '../machines/MachineStatusBadge';

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });

export function IncidentsCard() {
  const { data: incidents, isPending, isError, error } = useIncidents();
  const updateMachine = useUpdateMachine();
  // Solo se marca como "cargando" el botón de la máquina que se está reactivando
  const reactivatingId = updateMachine.isPending ? updateMachine.variables.id : null;

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
  } else if (incidents.length === 0) {
    content = (
      <Text c="dimmed" size="sm">
        Sin incidencias registradas
      </Text>
    );
  } else {
    content = (
      <Stack gap="sm">
        {incidents.map((incident) => (
          <Paper key={incident.id} withBorder radius="sm" p="xs" bd="1px solid red.3">
            <Group justify="space-between" wrap="nowrap">
              <Text size="sm" fw={600}>
                {incident.machine?.name ?? 'Sin máquina'} · {incident.order.code}
              </Text>
              {incident.machine && <MachineStatusBadge status={incident.machine.status} />}
            </Group>
            <Text size="sm">{incident.note}</Text>
            <Group justify="space-between" wrap="nowrap">
              <Text size="xs" c="dimmed">
                {incident.employee.name} · {formatDateTime(incident.endedAt)}
              </Text>
              {incident.machine && incident.machine.status !== 'ACTIVE' && (
                <Button
                  size="compact-xs"
                  variant="light"
                  color="green"
                  loading={reactivatingId === incident.machine.id}
                  onClick={() =>
                    updateMachine.mutate({ id: incident.machine!.id, data: { status: 'ACTIVE' } })
                  }
                >
                  Reactivar máquina
                </Button>
              )}
            </Group>
          </Paper>
        ))}
      </Stack>
    );
  }

  return (
    <Paper withBorder radius="md" p="md" h="100%">
      <Title order={4} mb="md">
        Incidencias recientes
      </Title>
      {content}
    </Paper>
  );
}
