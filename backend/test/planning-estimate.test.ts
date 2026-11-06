import { describe, expect, it } from 'vitest';
import {
  estimateWindow,
  findOverlaps,
  remainingMs,
  type PlannableOrder,
} from '../src/modules/planning/planning.estimate.js';

const at = (iso: string) => new Date(iso);
const NOW = at('2026-03-10T10:00:00Z');

const order = (data: Partial<PlannableOrder> = {}): PlannableOrder => ({
  id: 1,
  status: 'PENDING',
  quantity: 100,
  producedQty: 0,
  cycleTimeSec: 36, // 100 piezas = 1 h
  plannedStart: at('2026-03-10T12:00:00Z'),
  startedAt: null,
  ...data,
});

describe('remainingMs', () => {
  it('cuenta solo las piezas que faltan y nunca da negativo', () => {
    expect(remainingMs(order({ producedQty: 50 }))).toBe(1_800_000);
    expect(remainingMs(order({ producedQty: 120 }))).toBe(0);
  });

  it('sin ciclo no se puede estimar', () => {
    expect(remainingMs(order({ cycleTimeSec: null }))).toBeNull();
  });
});

describe('estimateWindow', () => {
  it('PENDING: desde plannedStart lo que falta', () => {
    expect(estimateWindow(order(), NOW)).toEqual({
      id: 1,
      start: at('2026-03-10T12:00:00Z'),
      end: at('2026-03-10T13:00:00Z'),
    });
  });

  it('PENDING sin plannedStart no tiene ventana', () => {
    expect(estimateWindow(order({ plannedStart: null }), NOW)).toBeNull();
  });

  it('IN_PROGRESS: empieza en startedAt y lo que falta cuenta desde ahora', () => {
    const inProgress = order({ status: 'IN_PROGRESS', producedQty: 50, startedAt: at('2026-03-10T08:00:00Z') });
    expect(estimateWindow(inProgress, NOW)).toEqual({
      id: 1,
      start: at('2026-03-10T08:00:00Z'),
      end: at('2026-03-10T10:30:00Z'),
    });
  });
});

describe('findOverlaps', () => {
  const w = (id: number, start: string, end: string) => ({ id, start: at(start), end: at(end) });

  it('marca los dos lados del solape', () => {
    const overlaps = findOverlaps([
      w(1, '2026-03-10T08:00:00Z', '2026-03-10T10:00:00Z'),
      w(2, '2026-03-10T09:00:00Z', '2026-03-10T11:00:00Z'),
      w(3, '2026-03-10T12:00:00Z', '2026-03-10T13:00:00Z'),
    ]);
    expect(overlaps.get(1)).toEqual([2]);
    expect(overlaps.get(2)).toEqual([1]);
    expect(overlaps.get(3)).toEqual([]);
  });

  it('acabar justo cuando empieza otra no es solape', () => {
    const overlaps = findOverlaps([
      w(1, '2026-03-10T08:00:00Z', '2026-03-10T10:00:00Z'),
      w(2, '2026-03-10T10:00:00Z', '2026-03-10T11:00:00Z'),
    ]);
    expect(overlaps.get(1)).toEqual([]);
  });

  it('una orden larga se solapa con varias aunque no vayan seguidas', () => {
    const overlaps = findOverlaps([
      w(1, '2026-03-10T08:00:00Z', '2026-03-10T18:00:00Z'),
      w(2, '2026-03-10T09:00:00Z', '2026-03-10T10:00:00Z'),
      w(3, '2026-03-10T12:00:00Z', '2026-03-10T13:00:00Z'),
    ]);
    expect(overlaps.get(1)).toEqual([2, 3]);
    expect(overlaps.get(2)).toEqual([1]);
  });
});
