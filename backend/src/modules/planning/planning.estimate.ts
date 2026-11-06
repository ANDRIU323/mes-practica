import type { OrderStatus } from '../orders/orders.schema.js';

// Solo se planifica lo que aún tiene trabajo por delante
export const PLANNABLE_STATUSES = ['PENDING', 'IN_PROGRESS'] as const satisfies OrderStatus[];

export interface PlannableOrder {
  id: number;
  status: OrderStatus;
  quantity: number;
  producedQty: number;
  cycleTimeSec: number | null;
  plannedStart: Date | null;
  startedAt: Date | null;
}

export interface PlanWindow {
  id: number;
  start: Date;
  end: Date;
}

// Lo que falta por fabricar a ritmo ideal. null sin ciclo: no se puede estimar
export function remainingMs(order: PlannableOrder): number | null {
  if (order.cycleTimeSec === null) return null;
  return Math.max(order.quantity - order.producedQty, 0) * order.cycleTimeSec * 1000;
}

// PENDING: de plannedStart a plannedStart + lo que falta.
// IN_PROGRESS: empezó en startedAt y lo que falta cuenta desde ahora (si ya pasó el inicio)
export function estimateWindow(order: PlannableOrder, now: Date): PlanWindow | null {
  const duration = remainingMs(order);
  const start = order.status === 'IN_PROGRESS' ? (order.startedAt ?? order.plannedStart) : order.plannedStart;
  if (duration === null || !start) return null;

  const from = order.status === 'IN_PROGRESS' ? Math.max(start.getTime(), now.getTime()) : start.getTime();
  return { id: order.id, start, end: new Date(from + duration) };
}

// Para cada orden, con qué otras de la misma máquina se solapa. Intervalos [start, end):
// acabar justo cuando empieza la siguiente no es solape
export function findOverlaps(windows: PlanWindow[]): Map<number, number[]> {
  const sorted = [...windows].sort((a, b) => a.start.getTime() - b.start.getTime());
  const overlaps = new Map<number, number[]>(windows.map((w) => [w.id, []]));

  for (let i = 0; i < sorted.length; i++) {
    // Ordenadas por inicio: en cuanto una empieza después del fin de i, las siguientes también
    for (let j = i + 1; j < sorted.length && sorted[j].start < sorted[i].end; j++) {
      overlaps.get(sorted[i].id)!.push(sorted[j].id);
      overlaps.get(sorted[j].id)!.push(sorted[i].id);
    }
  }
  return overlaps;
}
