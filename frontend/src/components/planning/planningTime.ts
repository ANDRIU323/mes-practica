import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import type { PlanningSpan } from '../../store/uiSlice';
import type { PlanningOrder } from '../../types/planning';

dayjs.extend(utc);
dayjs.extend(timezone);

const HOUR_MS = 3_600_000;

// Separación entre marcas del eje según los días visibles
const TICK_HOURS: Record<PlanningSpan, number> = { 1: 2, 3: 6, 7: 24 };

// Instantes en ms. [start, end): de la medianoche del primer día a la del día siguiente al último
export interface GanttWindow {
  start: number;
  end: number;
}

// Posición en % dentro de la ventana; layoutBars ya los recorta a [0, 100]
export interface GanttBar {
  order: PlanningOrder;
  left: number;
  width: number;
  lane: number;
}

export const addDays = (day: string, n: number) => dayjs(day).add(n, 'day').format('YYYY-MM-DD');

// Hoy en la planta, que puede no ser hoy en el navegador
export function plantToday(timeZone: string, now = Date.now()) {
  return dayjs(now).tz(timeZone).format('YYYY-MM-DD');
}

// Medianoche de un día de la planta como instante (con cambio de hora el día dura 23 o 25 h)
export function plantMidnight(day: string, timeZone: string) {
  return dayjs.tz(day, timeZone).valueOf();
}

export function ganttWindow(day: string, span: PlanningSpan, timeZone: string): GanttWindow {
  return { start: plantMidnight(day, timeZone), end: plantMidnight(addDays(day, span), timeZone) };
}

// Desde cada medianoche: así el día con cambio de hora no descoloca los días siguientes
export function ganttTicks(day: string, span: PlanningSpan, timeZone: string): number[] {
  const ticks: number[] = [];
  for (let d = 0; d < span; d++) {
    const midnight = plantMidnight(addDays(day, d), timeZone);
    for (let h = 0; h < 24; h += TICK_HOURS[span]) ticks.push(midnight + h * HOUR_MS);
  }
  return ticks;
}

export function toPercent(instant: number, window: GanttWindow) {
  return ((instant - window.start) / (window.end - window.start)) * 100;
}

// Barras de una máquina dentro de la ventana. Las que se solapan van en carriles distintos
// (el primero libre, de arriba abajo) para que se vean todas. Los carriles se calculan con
// las ventanas enteras, no recortadas: así no cambian al mover el rango
export function layoutBars(orders: PlanningOrder[], window: GanttWindow): { bars: GanttBar[]; lanes: number } {
  const timed = orders
    .filter((o) => o.estimatedStart !== null && o.estimatedEnd !== null)
    .map((order) => ({ order, start: Date.parse(order.estimatedStart!), end: Date.parse(order.estimatedEnd!) }))
    .sort((a, b) => a.start - b.start);

  const laneEnds: number[] = [];
  const bars: GanttBar[] = [];
  for (const { order, start, end } of timed) {
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) lane = laneEnds.push(end) - 1;
    else laneEnds[lane] = end;

    // end >= start de la ventana: una orden sin piezas pendientes (duración 0) también se ve
    if (start >= window.end || end < window.start) continue;
    const left = Math.max(toPercent(start, window), 0);
    const right = Math.min(toPercent(end, window), 100);
    bars.push({ order, left, width: right - left, lane });
  }
  return { bars, lanes: laneEnds.length };
}

// Copia de la lista con el elemento de `from` en la posición `to`
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const result = [...list];
  const [item] = result.splice(from, 1);
  result.splice(to, 0, item);
  return result;
}

// Lo que falta a ritmo ideal, igual que remainingMs del backend; null sin ciclo
export function remainingMs(order: Pick<PlanningOrder, 'quantity' | 'producedQty' | 'cycleTimeSec'>) {
  if (order.cycleTimeSec === null) return null;
  return Math.max(order.quantity - order.producedQty, 0) * order.cycleTimeSec * 1000;
}

export function formatDuration(ms: number) {
  const totalMinutes = Math.round(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}

// "lun 10/03" en la zona de la planta
export function formatPlantDay(instant: number, timeZone: string) {
  return new Intl.DateTimeFormat('es-ES', { timeZone, weekday: 'short', day: '2-digit', month: '2-digit' }).format(
    instant,
  );
}
