import type { Db } from '../../plugins/prisma.js';
import {
  MS_PER_HOUR,
  clampRange,
  employeeSelect,
  overlapMs,
  round2,
} from '../dashboard/dashboard.metrics.js';

// Detalle de una máquina en [from, to). null si no existe.
// - Órdenes: todas las que tiene asignadas ahora (no dependen del rango).
// - Incidencias: WorkLog MACHINE_ISSUE cerrados en el rango de órdenes de la máquina
//   (como en el dashboard, la máquina es la actual de la orden), con su mantenimiento.
// - Horas trabajadas: parte de cada WorkLog dentro del rango (uno abierto, hasta ahora).
// - Horas de mantenimiento: parte de cada periodo dentro del rango (uno abierto, hasta ahora).
// - MTBF = horas trabajadas / nº de incidencias; null sin incidencias.
export async function getMachineDetail(db: Db, machineId: number, range: { from: Date; to: Date }) {
  const machine = await db.machine.findUnique({
    where: { id: machineId },
    select: { id: true, code: true, name: true, status: true, createdAt: true },
  });
  if (!machine) return null;

  const { from, to, now } = clampRange(range);

  const [orders, workLogs, maintenances] = await Promise.all([
    db.productionOrder.findMany({
      where: { machineId },
      select: {
        id: true,
        code: true,
        product: true,
        quantity: true,
        producedQty: true,
        status: true,
        plannedStart: true,
        startedAt: true,
        finishedAt: true,
        assignedEmployee: { select: employeeSelect },
      },
      orderBy: { createdAt: 'desc' },
    }),
    db.workLog.findMany({
      where: {
        order: { machineId },
        startedAt: { lt: to },
        OR: [{ endedAt: null }, { endedAt: { gte: from } }],
      },
      select: {
        id: true,
        startedAt: true,
        endedAt: true,
        stopReason: true,
        note: true,
        employee: { select: employeeSelect },
        order: { select: { id: true, code: true } },
        maintenance: { select: { startedAt: true, endedAt: true } },
      },
      orderBy: { startedAt: 'asc' },
    }),
    db.machineMaintenance.findMany({
      where: {
        machineId,
        startedAt: { lt: to },
        OR: [{ endedAt: null }, { endedAt: { gt: from } }],
      },
      select: {
        id: true,
        startedAt: true,
        endedAt: true,
        workLog: { select: { note: true, order: { select: { code: true } } } },
      },
      orderBy: { startedAt: 'desc' },
    }),
  ]);

  const workedMs = workLogs.reduce(
    (ms, log) => ms + overlapMs(log.startedAt, log.endedAt ?? now, from, to),
    0,
  );
  const maintenanceMs = maintenances.reduce(
    (ms, m) => ms + overlapMs(m.startedAt, m.endedAt ?? now, from, to),
    0,
  );

  const incidents = workLogs
    .filter((log) => log.stopReason === 'MACHINE_ISSUE' && log.endedAt! < to)
    .map(({ id, endedAt, note, employee, order, maintenance }) => ({
      id,
      endedAt: endedAt!,
      note,
      employee,
      order,
      maintenance,
    }))
    .reverse();

  const workedHours = workedMs / MS_PER_HOUR;

  return {
    machine,
    from,
    to,
    metrics: {
      workedHours: round2(workedHours),
      maintenanceHours: round2(maintenanceMs / MS_PER_HOUR),
      failures: incidents.length,
      mtbfHours: incidents.length > 0 ? round2(workedHours / incidents.length) : null,
    },
    orders,
    incidents,
    maintenances: maintenances.map(({ workLog, ...m }) => ({
      ...m,
      orderCode: workLog?.order.code ?? null,
      note: workLog?.note ?? null,
    })),
  };
}
