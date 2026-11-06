import { Center, Group, Loader, Paper, SimpleGrid, Stack, Table, Text, Title, Tooltip } from '@mantine/core';
import type { DashboardOee, OeeResult } from '../../types/dashboard';

const percent = new Intl.NumberFormat('es-ES', { style: 'percent', maximumFractionDigits: 1 });
const hours = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 });

// Referencias habituales: 85 % es nivel "clase mundial", por debajo del 60 % hay mucho que mejorar
export function oeeColor(value: number) {
  if (value >= 0.85) return 'teal';
  if (value >= 0.6) return 'yellow';
  return 'red';
}

const NO_CYCLE = 'Sin órdenes con ciclo ideal en este rango';

function Percent({ value, colored = false }: { value: number | null; colored?: boolean }) {
  if (value === null) {
    return (
      <Tooltip label={NO_CYCLE}>
        <Text span c="dimmed">
          —
        </Text>
      </Tooltip>
    );
  }
  return (
    <Text span fw={colored ? 700 : undefined} c={colored ? oeeColor(value) : undefined}>
      {percent.format(value)}
    </Text>
  );
}

const SUMMARY: { key: keyof OeeResult; label: string }[] = [
  { key: 'oee', label: 'OEE' },
  { key: 'availability', label: 'Disponibilidad' },
  { key: 'performance', label: 'Rendimiento' },
  { key: 'quality', label: 'Calidad' },
];

interface OeeCardProps {
  // undefined mientras carga la primera vez. Sin from/to: también la usa el informe de turno
  data: Omit<DashboardOee, 'from' | 'to'> | undefined;
  error: Error | null;
}

export function OeeCard({ data, error }: OeeCardProps) {
  let content;
  if (error) {
    content = (
      <Text c="red" size="sm">
        {error.message}
      </Text>
    );
  } else if (!data) {
    content = (
      <Center py="xl">
        <Loader />
      </Center>
    );
  } else if (data.machines.length === 0) {
    content = (
      <Center py="xl">
        <Text c="dimmed" size="sm">
          Sin datos en este rango
        </Text>
      </Center>
    );
  } else {
    content = (
      <Stack>
        <SimpleGrid cols={{ base: 2, sm: 4 }}>
          {SUMMARY.map(({ key, label }) => (
            <Stack key={key} gap={0}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                {label}
              </Text>
              <Text size="xl">
                <Percent value={data.total[key]} colored={key === 'oee'} />
              </Text>
            </Stack>
          ))}
        </SimpleGrid>

        <Table.ScrollContainer minWidth={600}>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Máquina</Table.Th>
                <Table.Th ta="right">Trabajado (h)</Table.Th>
                <Table.Th ta="right">Paradas no previstas (h)</Table.Th>
                <Table.Th ta="right">Disponibilidad</Table.Th>
                <Table.Th ta="right">Rendimiento</Table.Th>
                <Table.Th ta="right">Calidad</Table.Th>
                <Table.Th ta="right">OEE</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.machines.map((row) => (
                <Table.Tr key={row.machine.id}>
                  <Table.Td>
                    {row.machine.code} · {row.machine.name}
                  </Table.Td>
                  <Table.Td ta="right">{hours.format(row.runHours)}</Table.Td>
                  <Table.Td ta="right">{hours.format(row.unplannedStopHours)}</Table.Td>
                  <Table.Td ta="right">
                    <Percent value={row.availability} />
                  </Table.Td>
                  <Table.Td ta="right">
                    <Percent value={row.performance} />
                  </Table.Td>
                  <Table.Td ta="right">
                    <Percent value={row.quality} />
                  </Table.Td>
                  <Table.Td ta="right">
                    <Percent value={row.oee} colored />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Stack>
    );
  }

  return (
    <Paper withBorder radius="md" p="md">
      <Group justify="space-between" mb="md">
        <Title order={4}>OEE por máquina</Title>
        <Text size="xs" c="dimmed">
          Paradas no previstas: incidencia y cambio de línea. Calidad 100 % hasta registrar rechazos
        </Text>
      </Group>
      {content}
    </Paper>
  );
}
