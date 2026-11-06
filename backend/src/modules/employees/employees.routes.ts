import { Prisma } from '@prisma/client';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  createEmployeeBody,
  employeeIdParams,
  setPinBody,
  updateEmployeeBody,
} from './employees.schema.js';
import { hashPassword } from '../../plugins/auth.js';

type WorkLogTimes = { startedAt: Date; endedAt: Date | null; producedQty: number };

// Un WorkLog abierto cuenta hasta ahora
function workedHours(logs: WorkLogTimes[], now = new Date()) {
  const ms = logs.reduce(
    (sum, log) => sum + ((log.endedAt ?? now).getTime() - log.startedAt.getTime()),
    0,
  );
  return Math.round((ms / 3_600_000) * 100) / 100;
}

function producedUnits(logs: WorkLogTimes[]) {
  return logs.reduce((sum, log) => sum + log.producedQty, 0);
}

const logTimesSelect = { startedAt: true, endedAt: true, producedQty: true } as const;

function isUniqueViolation(e: unknown) {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
}

function isNotFound(e: unknown) {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025';
}

const employeeRoutes: FastifyPluginAsyncZod = async (app) => {
  // GET /api/employees – con horas y unidades totales, y si tiene PIN (el hash no sale)
  app.get('/', async () => {
    const employees = await app.db.employee.findMany({
      orderBy: { code: 'asc' },
      include: { workLogs: { select: logTimesSelect } },
      omit: { pinHash: false },
    });
    return employees.map(({ workLogs, pinHash, ...employee }) => ({
      ...employee,
      hasPin: pinHash !== null,
      totalHours: workedHours(workLogs),
      totalUnits: producedUnits(workLogs),
    }));
  });

  // GET /api/employees/:id
  app.get('/:id', { schema: { params: employeeIdParams } }, async (req, reply) => {
    const employee = await app.db.employee.findUnique({ where: { id: req.params.id } });
    if (!employee) return reply.code(404).send({ message: 'Empleado no encontrado' });
    return employee;
  });

  // GET /api/employees/:id/stats – totales, desglose por orden y registros de trabajo
  app.get('/:id/stats', { schema: { params: employeeIdParams } }, async (req, reply) => {
    const employee = await app.db.employee.findUnique({
      where: { id: req.params.id },
      include: {
        workLogs: {
          select: {
            ...logTimesSelect,
            id: true,
            stopReason: true,
            note: true,
            order: { select: { id: true, code: true, product: true } },
          },
          orderBy: { startedAt: 'asc' },
        },
      },
    });
    if (!employee) return reply.code(404).send({ message: 'Empleado no encontrado' });

    const now = new Date();
    const { workLogs, ...data } = employee;

    // Agrupa los tramos por orden
    const byOrder = new Map<number, { order: (typeof workLogs)[number]['order']; logs: WorkLogTimes[] }>();
    for (const log of workLogs) {
      const group = byOrder.get(log.order.id) ?? { order: log.order, logs: [] };
      group.logs.push(log);
      byOrder.set(log.order.id, group);
    }

    return {
      employee: data,
      totalHours: workedHours(workLogs, now),
      totalUnits: producedUnits(workLogs),
      orders: [...byOrder.values()].map(({ order, logs }) => ({
        orderId: order.id,
        code: order.code,
        product: order.product,
        hours: workedHours(logs, now),
        units: producedUnits(logs),
        open: logs.some((log) => log.endedAt === null),
      })),
      // Del más reciente al más antiguo
      workLogs: [...workLogs].reverse().map((log) => ({
        id: log.id,
        orderCode: log.order.code,
        startedAt: log.startedAt,
        endedAt: log.endedAt,
        hours: workedHours([log], now),
        producedQty: log.producedQty,
        stopReason: log.stopReason,
        note: log.note,
      })),
    };
  });

  // POST /api/employees
  app.post('/', { schema: { body: createEmployeeBody } }, async (req, reply) => {
    try {
      const employee = await app.db.employee.create({ data: req.body });
      return reply.code(201).send(employee);
    } catch (e) {
      if (isUniqueViolation(e)) return reply.code(409).send({ message: 'Ya existe un empleado con ese código' });
      throw e;
    }
  });

  // PATCH /api/employees/:id
  app.patch(
    '/:id',
    { schema: { params: employeeIdParams, body: updateEmployeeBody } },
    async (req, reply) => {
      try {
        return await app.db.employee.update({ where: { id: req.params.id }, data: req.body });
      } catch (e) {
        if (isNotFound(e)) return reply.code(404).send({ message: 'Empleado no encontrado' });
        if (isUniqueViolation(e)) return reply.code(409).send({ message: 'Ya existe un empleado con ese código' });
        throw e;
      }
    },
  );

  // PUT /api/employees/:id/pin – pone o restablece el PIN y quita el bloqueo
  app.put('/:id/pin', { schema: { params: employeeIdParams, body: setPinBody } }, async (req, reply) => {
    try {
      await app.db.employee.update({
        where: { id: req.params.id },
        data: {
          pinHash: await hashPassword(req.body.pin),
          failedLoginAttempts: 0,
          firstFailedLoginAt: null,
          lockedUntil: null,
        },
      });
    } catch (e) {
      if (isNotFound(e)) return reply.code(404).send({ message: 'Empleado no encontrado' });
      throw e;
    }
    return reply.code(204).send();
  });

  // DELETE /api/employees/:id – solo sin histórico; si lo tiene, se desactiva
  app.delete('/:id', { schema: { params: employeeIdParams } }, async (req, reply) => {
    const logs = await app.db.workLog.count({ where: { employeeId: req.params.id } });
    if (logs > 0) {
      return reply
        .code(409)
        .send({ message: 'El empleado tiene registros de trabajo; desactívalo en lugar de borrarlo' });
    }
    try {
      await app.db.employee.delete({ where: { id: req.params.id } });
    } catch (e) {
      if (isNotFound(e)) return reply.code(404).send({ message: 'Empleado no encontrado' });
      throw e;
    }
    return reply.code(204).send();
  });
};

export default employeeRoutes;
