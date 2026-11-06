import { Badge, Center, Group, Loader, Paper, Stack, Text, Title } from '@mantine/core';
import { useLiveWork } from '../../hooks/useDashboard';
import { ElapsedTimer } from '../shopfloor/ElapsedTimer';

export function LiveWorkCard() {
  const { data: workLogs, isPending, isError, error } = useLiveWork();

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
  } else if (workLogs.length === 0) {
    content = (
      <Text c="dimmed" size="sm">
        Nadie está trabajando ahora mismo
      </Text>
    );
  } else {
    content = (
      <Stack gap="sm">
        {workLogs.map((log) => (
          <Group key={log.id} justify="space-between" wrap="nowrap">
            <div>
              <Text fw={600}>{log.employee.name}</Text>
              <Text size="sm" c="dimmed">
                {log.order.code} · {log.order.product}
                {log.machine && ` · ${log.machine.name}`}
              </Text>
            </div>
            <ElapsedTimer since={log.startedAt} fw={700} />
          </Group>
        ))}
      </Stack>
    );
  }

  return (
    <Paper withBorder radius="md" p="md" h="100%">
      <Group justify="space-between" mb="md">
        <Title order={4}>Trabajando ahora</Title>
        {workLogs && workLogs.length > 0 && (
          <Badge color="green" variant="light">
            {workLogs.length}
          </Badge>
        )}
      </Group>
      {content}
    </Paper>
  );
}
