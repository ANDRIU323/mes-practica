import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { statsQuery } from '../dashboard/dashboard.schema.js';
import { getMachineDetail } from './machines.detail.js';
import { lockMachine, trackMaintenance } from './machines.maintenance.js';
import {
  createMachineBody,
  machineIdParams,
  updateMachineBody,
} from './machines.schema.js';

const machineRoutes: FastifyPluginAsyncZod = async (app) => {
  // GET /api/machines
  app.get('/', async () => {
    return app.db.machine.findMany({
      orderBy: { code: 'asc' },
      include: { _count: { select: { orders: true } } },
    });
  });

  // GET /api/machines/:id
  app.get('/:id', { schema: { params: machineIdParams } }, async (req, reply) => {
    const machine = await app.db.machine.findUnique({
      where: { id: req.params.id },
      include: { orders: true },
    });
    if (!machine) return reply.code(404).send({ message: 'Máquina no encontrada' });
    return machine;
  });

  // GET /api/machines/:id/detail?from=&to= – órdenes, incidencias, mantenimiento y MTBF
  app.get(
    '/:id/detail',
    { schema: { params: machineIdParams, querystring: statsQuery } },
    async (req, reply) => {
      const detail = await getMachineDetail(app.db, req.params.id, req.query);
      if (!detail) return reply.code(404).send({ message: 'Máquina no encontrada' });
      return detail;
    },
  );

  // POST /api/machines
  app.post('/', { schema: { body: createMachineBody } }, async (req, reply) => {
    const machine = await app.db.machine.create({ data: req.body });
    return reply.code(201).send(machine);
  });

  // PATCH /api/machines/:id
  app.patch(
    '/:id',
    { schema: { params: machineIdParams, body: updateMachineBody } },
    async (req) => {
      const { status } = req.body;
      return app.db.$transaction(async (tx) => {
        const machine = await lockMachine(tx, req.params.id);
        if (status !== undefined && status !== machine.status) {
          await trackMaintenance(tx, machine.id, status);
        }
        return tx.machine.update({ where: { id: machine.id }, data: req.body });
      });
    },
  );

  // DELETE /api/machines/:id
  app.delete('/:id', { schema: { params: machineIdParams } }, async (req, reply) => {
    await app.db.machine.delete({ where: { id: req.params.id } });
    return reply.code(204).send();
  });
};

export default machineRoutes;
