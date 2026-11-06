import type { StopReason } from '@prisma/client';
import type { Db } from '../../plugins/prisma.js';

export const MS_PER_HOUR = 3_600_000;
export const MS_PER_MINUTE = 60_000;

export const round2 =(n: number) => Math.round(n * 100) / 100;

// El rango no pasa de "ahora": lo que aún no ha ocurrido no cuenta como parado
export function clampRange({ from, to }: { from: Date; to: Date }) {
  const now = new Date();
  return { from, to: to < now ? to : now, now };
}

// Milisegundos de [start, end) que caen dentro de [from, to)
export function overlapMs(start: Date, end: Date, from: Date, to: Date) {
  const ms = Math.min(end.getTime(), to.getTime()) - Math.max(start.getTime(), from.getTime());
  return Math.max(0, ms);
}

export const employeeSelect = { id: true, code: true, name: true } as const;
export const machineSelect = { id: true, code: true, name: true } as const;

// WorkLog que se solapan con [from, to), ordenados por inicio
export function findWorkLogsInRange(db: Pick<Db, 'workLog'>, from: Date, to: Date) {
  return db.workLog.findMany({
    where: {
      startedAt: { lt: to },
      OR: [{ endedAt: null }, { endedAt: { gte: from } }],
    },
    select: {
      startedAt: true,
      endedAt: true,
      producedQty: true,
      stopReason: true,
      employee: { select: employeeSelect },
      order: { select: { id: true, cycleTimeSec: true, machine: { select: machineSelect } } },
    },
    orderBy: { startedAt: 'asc' },
  });
}

export type RangeWorkLog = Awaited<ReturnType<typeof findWorkLogsInRange>>[number];

export interface Stop {
  machineId: number | null;
  reason: StopReason;
  ms: number;
}

// Tras cerrar un WorkLog dentro del rango, su máquina (o la orden, si no tiene) está
// parada hasta que empieza el siguiente WorkLog en ella, con el motivo de ese cierre.
// Se recorta a [from, to); `to` no debe pasar de "ahora"
export function findStops(workLogs: RangeWorkLog[], from: Date, to: Date): Stop[] {
  const resourceKey = (log: RangeWorkLog) =>
    log.order.machine ? `m${log.order.machine.id}` : `o${log.order.id}`;
  const startsByResource = new Map<string, Date[]>();
  for (const log of workLogs) {
    const key = resourceKey(log);
    startsByResource.set(key, [...(startsByResource.get(key) ?? []), log.startedAt]);
  }

  const stops: Stop[] = [];
  for (const log of workLogs) {
    if (!log.endedAt || !log.stopReason || log.endedAt < from || log.endedAt >= to) continue;
    const endedAt = log.endedAt;
    const nextStart = startsByResource.get(resourceKey(log))!.find((s) => s >= endedAt) ?? to;
    stops.push({
      machineId: log.order.machine?.id ?? null,
      reason: log.stopReason,
      ms: overlapMs(endedAt, nextStart, from, to),
    });
  }
  return stops;
}

type Totals = { hours: number; units: number };

// - Horas: solo la parte de cada WorkLog dentro del rango (uno abierto cuenta hasta ahora).
// - Unidades: las de los WorkLog cerrados dentro del rango (se declaran al cerrar).
// - Minutos parados por motivo (findStops)
export function computeStats(workLogs: RangeWorkLog[], from: Date, to: Date, now: Date) {
  const byEmployee = new Map<number, { employee: RangeWorkLog['employee'] } & Totals>();
  const byMachine = new Map<number, { machine: NonNullable<RangeWorkLog['order']['machine']> } & Totals>();

  for (const log of workLogs) {
    const hours = overlapMs(log.startedAt, log.endedAt ?? now, from, to) / MS_PER_HOUR;
    const units = log.endedAt && log.endedAt < to ? log.producedQty : 0;

    const e = byEmployee.get(log.employee.id) ?? { employee: log.employee, hours: 0, units: 0 };
    e.hours += hours;
    e.units += units;
    byEmployee.set(log.employee.id, e);

    const machine = log.order.machine;
    if (machine) {
      const m = byMachine.get(machine.id) ?? { machine, hours: 0, units: 0 };
      m.hours += hours;
      m.units += units;
      byMachine.set(machine.id, m);
    }
  }

  const stoppedMs = new Map<StopReason, number>();
  for (const { reason, ms } of findStops(workLogs, from, to)) {
    stoppedMs.set(reason, (stoppedMs.get(reason) ?? 0) + ms);
  }

  const roundTotals = <T extends Totals>(t: T) => ({ ...t, hours: round2(t.hours) });

  return {
    employees: [...byEmployee.values()].map(roundTotals).sort((a, b) => b.hours - a.hours),
    machines: [...byMachine.values()].map(roundTotals).sort((a, b) => b.hours - a.hours),
    stoppedMinutes: [...stoppedMs].map(([reason, ms]) => ({
      reason,
      minutes: Math.round(ms / MS_PER_MINUTE),
    })),
  };
}
