import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { Prisma } from '@prisma/client';
import { machineIdParams } from '../machines/machines.schema.js';
import { lockMachine } from '../machines/machines.maintenance.js';
import { HttpError } from '../orders/worklogs.js';
import { PLANT_TIME_ZONE } from '../shifts/shifts.time.js';
import { estimateWindow, findOverlaps, PLANNABLE_STATUSES } from './planning.estimate.js';
import { sequenceBody } from './planning.schema.js';

// Orden de la cola: priority (null al final); a igualdad, la que antes esté prevista
const QUEUE_ORDER: Prisma.ProductionOrderOrderByWithRelationInput[] = [
  { priority: { sort: 'asc', nulls: 'last' } },
  { plannedStart: { sort: 'asc', nulls: 'last' } },
  { id: 'asc' },
];

const planningRoutes: FastifyPluginAsyncZod = async (app) => {
  // GET /api/planning – cola de cada máquina (PENDING/IN_PROGRESS) con su ventana
  // estimada y los solapes; las órdenes sin máquina van aparte
  app.get('/', async () => {
    const now = new Date();
    const [machines, orders] = await Promise.all([
      app.db.machine.findMany({
        select: { id: true, code: true, name: true, status: true },
        orderBy: { code: 'asc' },
      }),
      app.db.productionOrder.findMany({
        where: { status: { in: [...PLANNABLE_STATUSES] } },
        select: {
          id: true,
          code: true,
          product: true,
          status: true,
          quantity: true,
          producedQty: true,
          cycleTimeSec: true,
          machineId: true,
          priority: true,
          plannedStart: true,
          startedAt: true,
          assignedEmployee: { select: { id: true, code: true, name: true } },
        },
        orderBy: QUEUE_ORDER,
      }),
    ]);

    const withWindow = (machineOrders: typeof orders) => {
      const windows = new Map(machineOrders.map((o) => [o.id, estimateWindow(o, now)]));
      const overlaps = findOverlaps([...windows.values()].filter((w) => w !== null));
      return machineOrders.map(({ machineId, ...order }) => ({
        ...order,
        estimatedStart: windows.get(order.id)?.start ?? null,
        estimatedEnd: windows.get(order.id)?.end ?? null,
        overlapsWith: overlaps.get(order.id) ?? [],
      }));
    };

    // timeZone: el Gantt se pinta en hora de la planta, no en la del navegador
    return {
      timeZone: PLANT_TIME_ZONE,
      machines: machines.map((machine) => ({
        ...machine,
        orders: withWindow(orders.filter((o) => o.machineId === machine.id)),
      })),
      withoutMachine: withWindow(orders.filter((o) => o.machineId === null)),
    };
  });

  // PUT /api/planning/machines/:id/sequence – reordena la cola de una máquina.
  // Debe traer exactamente sus órdenes PENDING/IN_PROGRESS; si no coincide, otro cambio
  // llegó antes (409) y el cliente recarga
  app.put(
    '/machines/:id/sequence',
    { schema: { params: machineIdParams, body: sequenceBody } },
    async (req, reply) => {
      const { orderIds } = req.body;

      await app.db.$transaction(async (tx) => {
        await lockMachine(tx, req.params.id);
        const queue = await tx.productionOrder.findMany({
          where: { machineId: req.params.id, status: { in: [...PLANNABLE_STATUSES] } },
          select: { id: true },
        });

        const current = new Set(queue.map((o) => o.id));
        if (orderIds.length !== current.size || orderIds.some((id) => !current.has(id))) {
          throw new HttpError(409, 'La cola de la máquina ha cambiado: recarga la planificación');
        }

        for (const [priority, id] of orderIds.entries()) {
          await tx.productionOrder.update({ where: { id }, data: { priority } });
        }
      });

      return reply.code(204).send();
    },
  );
};

export default planningRoutes;
