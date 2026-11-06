import { Center, Paper, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';

interface ChartCardProps {
  title: string;
  isEmpty: boolean;
  children: ReactNode;
}

// Marco común de los gráficos de Informes, con mensaje si el rango no tiene datos
export function ChartCard({ title, isEmpty, children }: ChartCardProps) {
  return (
    <Paper withBorder radius="md" p="md" h="100%">
      <Title order={4} mb="md">
        {title}
      </Title>
      {isEmpty ? (
        <Center h={300}>
          <Text c="dimmed" size="sm">
            Sin datos en este rango
          </Text>
        </Center>
      ) : (
        children
      )}
    </Paper>
  );
}
