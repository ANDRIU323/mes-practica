import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { FastifyRequest } from 'fastify';
import type { ShiftType } from '@prisma/client';
import type { Db } from '../../plugins/prisma.js';
import {
  clampRange,
  computeStats,
  employeeSelect,
  findStops,
  findWorkLogsInRange,
  machineSelect,
} from '../dashboard/dashboard.metrics.js';
import { computeOee } from '../dashboard/dashboard.oee.js';
import { HttpError } from '../orders/worklogs.js';
import { closeShiftBody, listShiftsQuery, shiftParams } from './shifts.schema.js';
import { PLANT_TIME_ZONE, shiftAt, shiftsBetween, shiftWindow, type LocalDay } from './shifts.time.js';

// La columna `date` es DATE: Prisma la lee y escribe como medianoche UTC
const toDbDate = (day: LocalDay) => new Date(`${day}T00:00:00Z`);
const fromDbDate = (date: Date): LocalDay => date.toISOString().slice(0, 10);

const shiftSelect = {
  date: true,
  type: true,
  startsAt: true,
  endsAt: true,
  closedAt: true,
  closedBy: { select: { id: true, name: true } },
} as const;

interface ShiftRow {
  date: LocalDay;
  type: ShiftType;
  startsAt: Date;
  endsAt: Date;
  closedAt: Date | null;
  closedBy: { id: number; name: string } | null;
}

// UPCOMING → ACTIVE → ENDED (sin cerrar) → CLOSED
function withStatus(shift: ShiftRow, now: Date) {
  const status = shift.closedAt
    ? 'CLOSED'
    : now < shift.startsAt
      ? 'UPCOMING'
      : now < shift.endsAt
        ? 'ACTIVE'
        : 'ENDED';
  return { ...shift, status };
}

// El turno guardado (con su horario congelado) o, si aún no hay fila, el calculado
async function findShift(db: Pick<Db, 'shift'>, date: LocalDay, type: ShiftType): Promise<ShiftRow> {
  const row = await db.shift.findUnique({
    where: { date_type: { date: toDbDate(date), type } },
    select: shiftSelect,
  });
  if (row) return { ...row, date: fromDbDate(row.date) };
  return { date, type, ...shiftWindow(date, type), closedAt: null, closedBy: null };
}

// WorkLog sin cerrar que empezaron antes del fin del turno (incluye los de turnos anteriores)
function findOpenWorkLogs(db: Pick<Db, 'workLog'>, endsAt: Date) {
  return db.workLog
    .findMany({
      where: { endedAt: null, startedAt: { lt: endsAt } },
      select: {
        id: true,
        startedAt: true,
        employee: { select: employeeSelect },
        order: { select: { id: true, code: true, machine: { select: machineSelect } } },
      },
      orderBy: { startedAt: 'asc' },
    })
    .then((logs) => logs.map(({ order: { machine, ...order }, ...log }) => ({ ...log, order, machine })));
}

function adminId(req: FastifyRequest) {
  if (req.user.role !== 'ADMIN') throw new HttpError(403, 'No tienes permiso para esta acción');
  return req.user.sub;
}

const shiftRoutes: FastifyPluginAsyncZod = async (app) => {
  // GET /api/shifts?from=&to= – los tres turnos de cada día local (incluidos los dos)
  // y cuáles están cerrados; sin rango, los del día del turno actual.
  // `timeZone` para que el frontend pinte las horas de la planta
  app.get('/', { schema: { querystring: listShiftsQuery } }, async (req) => {
    const now = new Date();
    const current = shiftAt(now);
    const { from = current.date, to = current.date } = req.query;
    const rows = await app.db.shift.findMany({
      where: { date: { gte: toDbDate(from), lte: toDbDate(to) } },
      select: shiftSelect,
    });
    const saved = new Map(rows.map((r) => [`${fromDbDate(r.date)}|${r.type}`, r]));

    const shifts = shiftsBetween(from, to).map((computed) => {
      const row = saved.get(`${computed.date}|${computed.type}`);
      const shift: ShiftRow = row
        ? { ...row, date: computed.date }
        : { ...computed, closedAt: null, closedBy: null };
      return withStatus(shift, now);
    });

    return { timeZone: PLANT_TIME_ZONE, from, to, current, shifts };
  });

  // GET /api/shifts/:date/:type – informe del turno: horas, unidades, paradas y OEE
  // en [inicio, fin) recortado a ahora, y los WorkLog que siguen abiertos
  app.get('/:date/:type', { schema: { params: shiftParams } }, async (req) => {
    const shift = await findShift(app.db, req.params.date, req.params.type);
    const { from, to, now } = clampRange({ from: shift.startsAt, to: shift.endsAt });
    if (now < from) throw new HttpError(400, 'El turno aún no ha empezado');

    const workLogs = await findWorkLogsInRange(app.db, from, to);
    return {
      shift: withStatus(shift, now),
      openWorkLogs: await findOpenWorkLogs(app.db, shift.endsAt),
      stats: computeStats(workLogs, from, to, now),
      oee: computeOee(workLogs, findStops(workLogs, from, to), from, to, now),
    };
  });

  // POST /api/shifts/:date/:type/close – cierra el turno (desde que empieza).
  // Con WorkLog abiertos y sin `force` no cierra: 409 con la lista para avisar.
  // Con `force` cierra igualmente y devuelve la lista (los WorkLog no se tocan)
  app.post(
    '/:date/:type/close',
    { schema: { params: shiftParams, body: closeShiftBody } },
    async (req, reply) => {
      const { date, type } = req.params;
      const closedById = adminId(req);
      const window = shiftWindow(date, type);
      const now = new Date();
      if (now < window.startsAt) throw new HttpError(400, 'El turno aún no ha empezado');

      const result = await app.db.$transaction(async (tx) => {
        // La fila se crea al cerrar (o se reutiliza si ya existe): update vacío
        const row = await tx.shift.upsert({
          where: { date_type: { date: toDbDate(date), type } },
          create: { date: toDbDate(date), type, ...window },
          update: {},
          select: { closedAt: true, endsAt: true },
        });
        if (row.closedAt) throw new HttpError(409, 'El turno ya está cerrado');

        const openWorkLogs = await findOpenWorkLogs(tx, row.endsAt);
        if (openWorkLogs.length > 0 && !req.body.force) return { closed: false as const, openWorkLogs };

        // closedAt: null en el where: si otro admin lo ha cerrado entre medias, no se pisa
        const { count } = await tx.shift.updateMany({
          where: { date: toDbDate(date), type, closedAt: null },
          data: { closedAt: now, closedById },
        });
        if (count === 0) throw new HttpError(409, 'El turno ya está cerrado');
        return { closed: true as const, openWorkLogs };
      });

      if (!result.closed) {
        return reply.code(409).send({
          message: `Quedan ${result.openWorkLogs.length} registros de trabajo abiertos`,
          openWorkLogs: result.openWorkLogs,
        });
      }
      const shift = await findShift(app.db, date, type);
      return { shift: withStatus(shift, now), openWorkLogs: result.openWorkLogs };
    },
  );
};

export default shiftRoutes;
