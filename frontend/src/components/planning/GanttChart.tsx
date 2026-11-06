import { Box, Group, ScrollArea, Stack, Text, Tooltip, UnstyledButton } from '@mantine/core';
import type { PlanningMachine, PlanningOrder } from '../../types/planning';
import { MachineStatusBadge } from '../machines/MachineStatusBadge';
import { ORDER_STATUS_CONFIG } from '../orders/orderStatus';
import { formatPlantDateTime, formatPlantTime } from '../shifts/shiftConfig';
import { formatPlantDay, layoutBars, toPercent, type GanttWindow } from './planningTime';

const LABEL_WIDTH = 170;
const BAR_HEIGHT = 28;
const LANE_GAP = 4;
const BORDER = '1px solid var(--mantine-color-default-border)';

interface GanttChartProps {
  machines: PlanningMachine[];
  timeZone: string;
  window: GanttWindow;
  ticks: number[];
  now: number;
  onSelect: (order: PlanningOrder) => void;
}

export function GanttChart({ machines, timeZone, window, ticks, now, onSelect }: GanttChartProps) {
  const nowPercent = toPercent(now, window);
  const showNow = nowPercent >= 0 && nowPercent <= 100;

  // Líneas verticales de las marcas y de "ahora", repetidas en cada fila
  const gridLines = (
    <>
      {ticks.map((tick) => (
        <Box key={tick} pos="absolute" top={0} bottom={0} left={`${toPercent(tick, window)}%`} w={1} style={{ borderLeft: BORDER }} />
      ))}
      {showNow && <Box pos="absolute" top={0} bottom={0} left={`${nowPercent}%`} w={2} bg="orange" />}
    </>
  );

  return (
    <ScrollArea type="auto">
      <Box miw={720}>
        <Group gap={0} wrap="nowrap" h={32}>
          <Box w={LABEL_WIDTH} style={{ flexShrink: 0 }} />
          <Box pos="relative" h="100%" style={{ flex: 1 }}>
            {ticks.map((tick) => {
              const time = formatPlantTime(new Date(tick).toISOString(), timeZone);
              return (
                <Text key={tick} pos="absolute" left={`${toPercent(tick, window)}%`} top={8} pl={4} size="xs" c="dimmed">
                  {time === '00:00' ? formatPlantDay(tick, timeZone) : time}
                </Text>
              );
            })}
          </Box>
        </Group>

        {machines.map((machine) => {
          const { bars, lanes } = layoutBars(machine.orders, window);
          const codes = new Map(machine.orders.map((o) => [o.id, o.code]));
          return (
            <Group key={machine.id} gap={0} wrap="nowrap" align="stretch" style={{ borderTop: BORDER }}>
              <Stack w={LABEL_WIDTH} gap={2} py={6} pr="sm" style={{ flexShrink: 0 }}>
                <Text size="sm" fw={500}>
                  {machine.code}
                </Text>
                <Text size="xs" c="dimmed" truncate>
                  {machine.name}
                </Text>
                {machine.status !== 'ACTIVE' && <MachineStatusBadge status={machine.status} />}
              </Stack>

              <Box pos="relative" mih={Math.max(lanes, 1) * (BAR_HEIGHT + LANE_GAP) + LANE_GAP} style={{ flex: 1 }}>
                {gridLines}
                {bars.map(({ order, left, width, lane }) => {
                  const overlapping = order.overlapsWith.length > 0;
                  const color = overlapping ? 'red' : ORDER_STATUS_CONFIG[order.status].color;
                  return (
                    <Tooltip
                      key={order.id}
                      multiline
                      withArrow
                      label={
                        <>
                          <Text size="xs" fw={500}>
                            {order.code} · {order.product}
                          </Text>
                          <Text size="xs">
                            {formatPlantDateTime(order.estimatedStart!, timeZone)} →{' '}
                            {formatPlantDateTime(order.estimatedEnd!, timeZone)}
                          </Text>
                          <Text size="xs">
                            {order.producedQty} / {order.quantity} uds · {ORDER_STATUS_CONFIG[order.status].label}
                          </Text>
                          {overlapping && (
                            <Text size="xs">Se solapa con {order.overlapsWith.map((id) => codes.get(id)).join(', ')}</Text>
                          )}
                        </>
                      }
                    >
                      <UnstyledButton
                        aria-label={`${order.code}${overlapping ? ' (solapada)' : ''}`}
                        onClick={() => onSelect(order)}
                        pos="absolute"
                        top={LANE_GAP + lane * (BAR_HEIGHT + LANE_GAP)}
                        left={`${left}%`}
                        w={`${width}%`}
                        h={BAR_HEIGHT}
                        px={6}
                        bg={`var(--mantine-color-${color}-filled)`}
                        c="white"
                        fz="xs"
                        style={{
                          minWidth: 6,
                          borderRadius: 'var(--mantine-radius-sm)',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {order.code}
                      </UnstyledButton>
                    </Tooltip>
                  );
                })}
              </Box>
            </Group>
          );
        })}
      </Box>
    </ScrollArea>
  );
}
