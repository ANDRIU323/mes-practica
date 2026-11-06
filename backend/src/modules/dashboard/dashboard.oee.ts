import type { StopReason } from '@prisma/client';
import { MS_PER_HOUR, type RangeWorkLog, type Stop, overlapMs } from './dashboard.metrics.js';

// Fin de turno y descanso son paradas previstas: no restan Disponibilidad
export const UNPLANNED_STOP_REASONS: StopReason[] = ['MACHINE_ISSUE', 'LINE_CHANGE'];

// Milisegundos acumulados de una máquina (o del total)
interface OeeTotals {
  runMs: number;
  unplannedStopMs: number;
  // Solo WorkLog cerrados de órdenes con cycleTimeSec: tiempo en el rango y tiempo ideal
  // de sus unidades en el rango
  ratedRunMs: number;
  idealMs: number;
}

// Proporciones de 0 a 1 (el rendimiento puede pasar de 1 si el ciclo ideal es pesimista).
// null = sin datos para calcularla
export interface OeeResult {
  runHours: number;
  unplannedStopHours: number;
  availability: number | null;
  performance: number | null;
  quality: number | null;
  oee: number | null;
}

const emptyTotals = (): OeeTotals => ({ runMs: 0, unplannedStopMs: 0, ratedRunMs: 0, idealMs: 0 });
const round = (n: number, decimals: number) => Math.round(n * 10 ** decimals) / 10 ** decimals;
const ratio = (part: number, whole: number) => (whole > 0 ? part / whole : null);
// Se redondea solo al devolver: el OEE se calcula con los valores sin redondear
const round4 = (n: number | null) => (n === null ? null : round(n, 4));

function toResult(t: OeeTotals): OeeResult {
  const availability = ratio(t.runMs, t.runMs + t.unplannedStopMs);
  const performance = ratio(t.idealMs, t.ratedRunMs);
  // Sin piezas rechazadas registradas todavía: todo lo fabricado cuenta como bueno
  const quality = performance === null ? null : 1;
  const oee =
    availability === null || performance === null || quality === null
      ? null
      : availability * performance * quality;
  return {
    runHours: round(t.runMs / MS_PER_HOUR, 2),
    unplannedStopHours: round(t.unplannedStopMs / MS_PER_HOUR, 2),
    availability: round4(availability),
    performance: round4(performance),
    quality,
    oee: round4(oee),
  };
}

// OEE = Disponibilidad × Rendimiento × Calidad, por máquina y en total. Las órdenes
// sin máquina no cuentan. Las unidades se declaran al cerrar el WorkLog: si solo parte
// de él cae en el rango, se cuenta esa parte proporcional de sus unidades.
// Los totales suman milisegundos (no se promedian los porcentajes de cada máquina)
export function computeOee(workLogs: RangeWorkLog[], stops: Stop[], from: Date, to: Date, now: Date) {
  const byMachine = new Map<number, { machine: NonNullable<RangeWorkLog['order']['machine']> } & OeeTotals>();
  const totalOf = (machine: NonNullable<RangeWorkLog['order']['machine']>) => {
    const t = byMachine.get(machine.id) ?? { machine, ...emptyTotals() };
    byMachine.set(machine.id, t);
    return t;
  };

  for (const log of workLogs) {
    const { machine, cycleTimeSec } = log.order;
    if (!machine) continue;
    const t = totalOf(machine);
    const inRangeMs = overlapMs(log.startedAt, log.endedAt ?? now, from, to);
    t.runMs += inRangeMs;

    const durationMs = log.endedAt ? log.endedAt.getTime() - log.startedAt.getTime() : 0;
    if (log.endedAt && cycleTimeSec && durationMs > 0) {
      t.ratedRunMs += inRangeMs;
      t.idealMs += log.producedQty * cycleTimeSec * 1000 * (inRangeMs / durationMs);
    }
  }

  for (const stop of stops) {
    if (stop.machineId === null || !UNPLANNED_STOP_REASONS.includes(stop.reason)) continue;
    const t = byMachine.get(stop.machineId);
    if (t) t.unplannedStopMs += stop.ms;
  }

  const total = emptyTotals();
  for (const t of byMachine.values()) {
    total.runMs += t.runMs;
    total.unplannedStopMs += t.unplannedStopMs;
    total.ratedRunMs += t.ratedRunMs;
    total.idealMs += t.idealMs;
  }

  return {
    total: toResult(total),
    machines: [...byMachine.values()]
      .map(({ machine, ...t }) => ({ machine, ...toResult(t) }))
      .sort((a, b) => (a.oee ?? Infinity) - (b.oee ?? Infinity)),
  };
}
