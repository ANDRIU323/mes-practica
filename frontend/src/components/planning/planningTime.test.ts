import { describe, expect, it } from 'vitest';
import type { PlanningOrder } from '../../types/planning';
import { formatDuration, ganttTicks, ganttWindow, layoutBars, moveItem, plantToday } from './planningTime';

// Tokio (UTC+9, sin cambio de hora) y Madrid (con cambio de hora el 29/03/2026)
const TOKYO = 'Asia/Tokyo';
const MADRID = 'Europe/Madrid';

function order(id: number, estimatedStart: string | null, estimatedEnd: string | null): PlanningOrder {
  return {
    id,
    code: `OF-${id}`,
    product: 'Pieza',
    status: 'PENDING',
    quantity: 10,
    producedQty: 0,
    cycleTimeSec: 60,
    priority: null,
    plannedStart: estimatedStart,
    startedAt: null,
    assignedEmployee: null,
    estimatedStart,
    estimatedEnd,
    overlapsWith: [],
  };
}

describe('ventana y marcas', () => {
  it('va de medianoche a medianoche en la zona de la planta', () => {
    expect(ganttWindow('2026-01-10', 1, TOKYO)).toEqual({
      start: Date.parse('2026-01-09T15:00:00Z'),
      end: Date.parse('2026-01-10T15:00:00Z'),
    });
  });

  it('el día del cambio de hora dura 23 h', () => {
    const { start, end } = ganttWindow('2026-03-29', 1, MADRID);
    expect((end - start) / 3_600_000).toBe(23);
  });

  it('marcas cada 2 h en un día, cada 6 h en tres y una por día en siete', () => {
    expect(ganttTicks('2026-01-10', 1, TOKYO)).toHaveLength(12);
    expect(ganttTicks('2026-01-10', 3, TOKYO)).toHaveLength(12);
    expect(ganttTicks('2026-01-10', 7, TOKYO)).toHaveLength(7);
  });

  it('hoy en la planta puede ser mañana en UTC', () => {
    expect(plantToday(TOKYO, Date.parse('2026-01-10T20:00:00Z'))).toBe('2026-01-11');
  });
});

describe('layoutBars', () => {
  const window = ganttWindow('2026-01-10', 1, TOKYO); // 09/01 15:00Z – 10/01 15:00Z

  it('pone en otro carril las que se solapan y reutiliza el carril libre', () => {
    const { bars, lanes } = layoutBars(
      [
        order(1, '2026-01-09T16:00:00Z', '2026-01-09T20:00:00Z'),
        order(2, '2026-01-09T18:00:00Z', '2026-01-09T22:00:00Z'),
        order(3, '2026-01-09T20:00:00Z', '2026-01-09T21:00:00Z'),
      ],
      window,
    );
    expect(lanes).toBe(2);
    expect(bars.map((b) => [b.order.id, b.lane])).toEqual([[1, 0], [2, 1], [3, 0]]);
  });

  it('recorta a la ventana y deja fuera lo que no cae en ella o no tiene fechas', () => {
    const { bars } = layoutBars(
      [
        order(1, '2026-01-09T09:00:00Z', '2026-01-09T21:00:00Z'), // empieza antes
        order(2, '2026-01-11T00:00:00Z', '2026-01-11T02:00:00Z'), // después
        order(3, null, null),
      ],
      window,
    );
    expect(bars).toHaveLength(1);
    expect(bars[0].left).toBe(0);
    expect(bars[0].width).toBe(25); // 15:00 → 21:00 de 24 h
  });
});

describe('utilidades', () => {
  it('moveItem mueve sin tocar la lista original', () => {
    const list = [1, 2, 3, 4];
    expect(moveItem(list, 0, 2)).toEqual([2, 3, 1, 4]);
    expect(moveItem(list, 3, 0)).toEqual([4, 1, 2, 3]);
    expect(list).toEqual([1, 2, 3, 4]);
  });

  it('formatDuration', () => {
    expect(formatDuration(45 * 60_000)).toBe('45 min');
    expect(formatDuration(3 * 3_600_000)).toBe('3 h');
    expect(formatDuration(150 * 60_000)).toBe('2 h 30 min');
  });
});
