import type { FastifyRequest } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { ORDER_STATUS_LABELS, orderIdParams } from '../orders/orders.schema.js';
import { HttpError, closeWorkLog, lockEmployee, lockOrder } from '../orders/worklogs.js';
import { stopWorkLogBody, workLogIdParams } from './shopfloor.schema.js';

// El contexto de app.ts ya exige rol EMPLOYEE; esto solo lo comprueba para TypeScript
function currentEmployeeId(req: FastifyRequest) {
  if (req.user.role !== 'EMPLOYEE') throw new HttpError(403, 'No tienes permiso para esta acción');
  return req.user.employeeId;
}

const shopfloorRoutes: FastifyPluginAsyncZod = async (app) => {
  // El JWT dura 8 h: si el empleado se desactiva entretanto, deja de poder trabajar
  app.addHook('onRequest', async (req, reply) => {
    const employee = await app.db.employee.findUnique({
      where: { id: currentEmployeeId(req) },
      select: { active: true },
    });
    if (!employee?.active) return reply.code(401).send({ message: 'No autorizado' });
  });

  // GET /api/shopfloor/orders -> órdenes pendientes o en curso asignadas al empleado,
  // cada una con su WorkLog abierto (como mucho uno en total)
  app.get('/orders', async (req) => {
    const employeeId = currentEmployeeId(req);
    const orders = await app.db.productionOrder.findMany({
      where: { assignedEmployeeId: employeeId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
      select: {
        id: true,
        code: true,
        product: true,
        quantity: true,
        producedQty: true,
        status: true,
        plannedStart: true,
        machine: { select: { code: true, name: true } },
        workLogs: { where: { employeeId, endedAt: null }, select: { id: true, startedAt: true } },
      },
      // Las planificadas primero (en Postgres los null van al final en orden ascendente)
      orderBy: [{ plannedStart: 'asc' }, { createdAt: 'asc' }],
    });
    return orders.map(({ workLogs, ...order }) => ({ ...order, openWorkLog: workLogs[0] ?? null }));
  });

  // POST /api/shopfloor/orders/:id/start -> abre un WorkLog; si la orden estaba
  // pendiente pasa a en curso
  app.post('/orders/:id/start', { schema: { params: orderIdParams } }, async (req, reply) => {
    const employeeId = currentEmployeeId(req);

    const workLog = await app.db.$transaction(async (tx) => {
      // Siempre empleado y luego orden: con el mismo orden de bloqueo no hay interbloqueos
      await lockEmployee(tx, employeeId);
      const order = await lockOrder(tx, req.params.id);

      if (order.assignedEmployeeId !== employeeId) {
        throw new HttpError(403, 'Esta orden no está asignada a ti');
      }
      if (order.status !== 'PENDING' && order.status !== 'IN_PROGRESS') {
        throw new HttpError(400, `La orden está "${ORDER_STATUS_LABELS[order.status]}" y no admite trabajo`);
      }

      const open = await tx.workLog.findFirst({
        where: { employeeId, endedAt: null },
        select: { order: { select: { id: true, code: true } } },
      });
      if (open) {
        throw new HttpError(
          400,
          open.order.id === order.id
            ? 'Ya estás trabajando en esta orden'
            : `Ya estás trabajando en la orden ${open.order.code}: finalízala antes de iniciar otra`,
        );
      }

      if (order.status === 'PENDING') {
        await tx.productionOrder.update({
          where: { id: order.id },
          data: { status: 'IN_PROGRESS', startedAt: new Date() },
        });
      }
      return tx.workLog.create({
        data: { orderId: order.id, employeeId },
        select: { id: true, orderId: true, startedAt: true },
      });
    });

    // Fuera de la transacción: si se deshace, no se avisa de algo que no ha pasado
    app.events.publish({ type: 'worklog.started', orderId: workLog.orderId });
    return reply.code(201).send(workLog);
  });

  // POST /api/shopfloor/worklogs/:id/stop -> cierra el WorkLog con unidades y motivo,
  // suma las unidades a la orden y la termina si llega a la cantidad pedida
  app.post(
    '/worklogs/:id/stop',
    { schema: { params: workLogIdParams, body: stopWorkLogBody } },
    async (req) => {
      const employeeId = currentEmployeeId(req);
      const { producedQty, stopReason, note } = req.body;

      const result = await app.db.$transaction(async (tx) => {
        // Hace falta orderId para bloquear la orden; si sigue abierto se mira ya con el bloqueo
        const found = await tx.workLog.findUnique({
          where: { id: req.params.id },
          select: { orderId: true, employeeId: true },
        });
        // Un WorkLog ajeno se trata como inexistente
        if (!found || found.employeeId !== employeeId) {
          throw new HttpError(404, 'Registro de trabajo no encontrado');
        }

        const order = await lockOrder(tx, found.orderId);
        const { endedAt } = await tx.workLog.findUniqueOrThrow({
          where: { id: req.params.id },
          select: { endedAt: true },
        });
        if (endedAt) throw new HttpError(400, 'Este trabajo ya está finalizado');

        return closeWorkLog(tx, req.params.id, order, { producedQty, stopReason, note: note || null });
      });

      app.events.publish({ type: 'worklog.closed', orderId: result.order.id, stopReason });
      return result;
    },
  );
};

export default shopfloorRoutes;
