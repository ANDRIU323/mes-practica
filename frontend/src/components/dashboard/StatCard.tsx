import { Paper, Text, UnstyledButton } from '@mantine/core';

interface StatCardProps {
  title: string;
  value: number | string;
  color: string;
  onClick?: () => void;
}

export function StatCard({ title, value, color, onClick }: StatCardProps) {
  const card = (
    <Paper withBorder radius="md" p="md">
      <Text size="sm" c="dimmed" fw={500}>
        {title}
      </Text>
      <Text fz={32} fw={700} c={color}>
        {value}
      </Text>
    </Paper>
  );

  if (!onClick) return card;
  return (
    <UnstyledButton w="100%" onClick={onClick}>
      {card}
    </UnstyledButton>
  );
}
