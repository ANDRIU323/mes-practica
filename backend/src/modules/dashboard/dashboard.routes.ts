import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  clampRange,
  computeStats,
  employeeSelect,
  findStops,
  findWorkLogsInRange,
  machineSelect,
} from './dashboard.metrics.js';
import { computeOee } from './dashboard.oee.js';
import { incidentsQuery, statsQuery } from './dashboard.schema.js';

const dashboardRoutes: FastifyPluginAsyncZod = async (app) => {
  // GET /api/dashboard/live – WorkLog abiertos (quién está trabajando ahora)
  app.get('/live', async () => {
    const workLogs = await app.db.workLog.findMany({
      where: { endedAt: null },
      select: {
        id: true,
        startedAt: true,
        employee: { select: employeeSelect },
        order: {
          select: { id: true, code: true, product: true, machine: { select: machineSelect } },
        },
      },
      orderBy: { startedAt: 'asc' },
    });
    return workLogs.map(({ order: { machine, ...order }, ...log }) => ({ ...log, order, machine }));
  });

  // GET /api/dashboard/incidents?limit= – últimos WorkLog cerrados con MACHINE_ISSUE.
  // La máquina es la que tiene ahora la orden (el WorkLog no la guarda).
  app.get('/incidents', { schema: { querystring: incidentsQuery } }, async (req) => {
    const workLogs = await app.db.workLog.findMany({
      where: { stopReason: 'MACHINE_ISSUE' },
      select: {
        id: true,
        endedAt: true,
        note: true,
        employee: { select: employeeSelect },
        order: {
          select: { id: true, code: true, machine: { select: { ...machineSelect, status: true } } },
        },
      },
      orderBy: { endedAt: 'desc' },
      take: req.query.limit,
    });
    return workLogs.map(({ order: { machine, ...order }, ...log }) => ({ ...log, order, machine }));
  });

  // GET /api/dashboard/stats?from=&to= – horas, unidades y minutos parados (computeStats)
  app.get('/stats', { schema: { querystring: statsQuery } }, async (req) => {
    const { from, to, now } = clampRange(req.query);
    const workLogs = await findWorkLogsInRange(app.db, from, to);
    return { from, to, ...computeStats(workLogs, from, to, now) };
  });

  // GET /api/dashboard/oee?from=&to= – OEE = Disponibilidad × Rendimiento × Calidad,
  // por máquina (peor primero) y en total. Reglas en dashboard.oee.ts
  app.get('/oee', { schema: { querystring: statsQuery } }, async (req) => {
    const { from, to, now } = clampRange(req.query);
    const workLogs = await findWorkLogsInRange(app.db, from, to);
    return { from, to, ...computeOee(workLogs, findStops(workLogs, from, to), from, to, now) };
  });
};

export default dashboardRoutes;
