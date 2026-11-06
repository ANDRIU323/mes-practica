import { Prisma } from '@prisma/client';
import type ExcelJS from 'exceljs';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { MACHINE_STATUS_LABELS } from '../machines/machines.schema.js';
import { buildOrdersExport } from './orders.export.js';
import {
  IMPORT_MAX_BYTES,
  NOT_XLSX_MESSAGE,
  buildImportTemplate,
  readOrdersWorkbook,
  resolveOrderRows,
} from './orders.import.js';
import {
  ORDER_STATUS_LABELS,
  ORDER_TRANSITIONS,
  type OrderStatus,
  assignEmployeeBody,
  changeStatusBody,
  createOrderBody,
  listOrdersQuery,
  orderIdParams,
  updateOrderBody,
} from './orders.schema.js';
import { HttpError, assertNoOpenWorkLog, checkEmployeeActive, lockOrder } from './worklogs.js';

const orderRoutes: FastifyPluginAsyncZod = async (app) => {
  // Devuelve el mensaje de error si la máquina no puede recibir órdenes, o null si puede
  async function checkMachineAvailable(machineId: number | null | undefined) {
    if (machineId == null) return null;
    const machine = await app.db.machine.findUnique({
      where: { id: machineId },
      select: { code: true, status: true },
    });
    if (!machine) return `La máquina ${machineId} no existe`;
    if (machine.status !== 'ACTIVE') {
      const label = MACHINE_STATUS_LABELS[machine.status];
      return `La máquina ${machine.code} está en estado "${label}" y no admite órdenes`;
    }
    return null;
  }

  // Lee el archivo del multipart. El body no pasa por Zod: el contenido lo valida orders.import.ts
  async function readUploadedXlsx(req: FastifyRequest) {
    const { InvalidMultipartContentTypeError, RequestFileTooLargeError } = app.multipartErrors;
    try {
      const file = await req.file();
      if (!file) throw new HttpError(400, 'Falta el archivo');
      const buffer = await file.toBuffer();
      if (!file.filename.toLowerCase().endsWith('.xlsx')) throw new HttpError(400, NOT_XLSX_MESSAGE);
      return buffer;
    } catch (e) {
      if (e instanceof InvalidMultipartContentTypeError) throw new HttpError(400, 'Falta el archivo');
      if (e instanceof RequestFileTooLargeError) {
        throw new HttpError(413, `El archivo supera el máximo de ${IMPORT_MAX_BYTES / 1024 / 1024} MB`);
      }
      throw e;
    }
  }

  // GET /api/orders?status=&machineId=
  app.get('/', { schema: { querystring: listOrdersQuery } }, async (req) => {
    const orders = await app.db.productionOrder.findMany({
      where: { status: req.query.status, machineId: req.query.machineId },
      include: {
        machine: { select: { id: true, code: true, name: true } },
        assignedEmployee: { select: { id: true, code: true, name: true } },
        workLogs: { where: { endedAt: null }, select: { id: true, employeeId: true, startedAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    // Como mucho hay un WorkLog abierto (índice único parcial)
    return orders.map(({ workLogs, ...order }) => ({ ...order, openWorkLog: workLogs[0] ?? null }));
  });

  // GET /api/orders/summary -> cuántas órdenes hay en cada estado (para el dashboard)
  app.get('/summary', async () => {
    const groups = await app.db.productionOrder.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    return groups.map((g) => ({ status: g.status, count: g._count._all }));
  });

  function sendXlsx(reply: FastifyReply, filename: string, buffer: ExcelJS.Buffer) {
    return reply
      .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(buffer);
  }

  // GET /api/orders/export?status=&machineId= -> las órdenes en .xlsx, con los mismos filtros que la lista
  app.get('/export', { schema: { querystring: listOrdersQuery } }, async (req, reply) =>
    sendXlsx(reply, 'ordenes.xlsx', await buildOrdersExport(app.db, req.query)),
  );

  // GET /api/orders/import/template -> plantilla .xlsx con cabeceras y una fila de ejemplo
  app.get('/import/template', async (_req, reply) =>
    sendXlsx(reply, 'plantilla-ordenes.xlsx', await buildImportTemplate()),
  );

  // POST /api/orders/import/preview -> valida el Excel sin guardar nada
  app.post('/import/preview', async (req) => {
    const rows = await readOrdersWorkbook(await readUploadedXlsx(req));
    return resolveOrderRows(app.db, rows);
  });

  // POST /api/orders/import -> vuelve a validar (la BD puede haber cambiado desde la vista
  // previa) y crea todas las órdenes o ninguna
  app.post('/import', async (req, reply) => {
    const rows = await readOrdersWorkbook(await readUploadedXlsx(req));

    try {
      const result = await app.db.$transaction(async (tx) => {
        const result = await resolveOrderRows(tx, rows);
        if (result.errors.length === 0) {
          await tx.productionOrder.createMany({ data: result.valid.map(({ row, ...order }) => order) });
        }
        return result;
      });

      if (result.errors.length > 0) {
        return reply.code(400).send({
          message: 'El archivo tiene errores: no se ha importado ninguna orden',
          errors: result.errors,
        });
      }
      return reply.code(201).send({ created: result.valid.length });
    } catch (e) {
      // Otra petición creó uno de los códigos entre la comprobación y el insert
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return reply.code(409).send({ message: 'Algún código ya existe: no se ha importado ninguna orden' });
      }
      throw e;
    }
  });

  // GET /api/orders/:id
  app.get('/:id', { schema: { params: orderIdParams } }, async (req, reply) => {
    const order = await app.db.productionOrder.findUnique({
      where: { id: req.params.id },
      include: { machine: true },
    });
    if (!order) return reply.code(404).send({ message: 'Orden no encontrada' });
    return order;
  });

  // POST /api/orders
  app.post('/', { schema: { body: createOrderBody } }, async (req, reply) => {
    const machineError = await checkMachineAvailable(req.body.machineId);
    if (machineError) return reply.code(400).send({ message: machineError });

    const order = await app.db.productionOrder.create({ data: req.body });
    return reply.code(201).send(order);
  });

  // PATCH /api/orders/:id
  app.patch(
    '/:id',
    { schema: { params: orderIdParams, body: updateOrderBody } },
    async (req, reply) => {
      // Solo se comprueba si el PATCH cambia la máquina
      const machineError = await checkMachineAvailable(req.body.machineId);
      if (machineError) return reply.code(400).send({ message: machineError });

      const current = await app.db.productionOrder.findUnique({
        where: { id: req.params.id },
        select: { machineId: true },
      });
      if (!current) return reply.code(404).send({ message: 'Orden no encontrada' });

      // En otra máquina pierde su puesto en la cola: va al final de la nueva
      const machineChanged = req.body.machineId !== undefined && req.body.machineId !== current.machineId;
      return app.db.productionOrder.update({
        where: { id: req.params.id },
        data: { ...req.body, ...(machineChanged && { priority: null }) },
      });
    },
  );

  // PATCH /api/orders/:id/status -> cambia el estado y guarda las fechas. Los WorkLog
  // los abre y cierra el empleado desde planta; con uno abierto no se termina ni cancela
  app.patch(
    '/:id/status',
    { schema: { params: orderIdParams, body: changeStatusBody } },
    async (req) => {
      const { status } = req.body;

      return app.db.$transaction(async (tx) => {
        const order = await lockOrder(tx, req.params.id);

        if (!ORDER_TRANSITIONS[order.status].includes(status)) {
          const label = (s: OrderStatus) => `"${ORDER_STATUS_LABELS[s]}"`;
          const allowed = ORDER_TRANSITIONS[order.status];
          throw new HttpError(
            400,
            allowed.length === 0
              ? `La orden está en estado ${label(order.status)} y no admite más cambios de estado`
              : `No se puede pasar de ${label(order.status)} a ${label(status)}. ` +
                `Permitidos: ${allowed.map(label).join(', ')}`,
          );
        }

        if (status === 'DONE' || status === 'CANCELLED') {
          await assertNoOpenWorkLog(tx, order.id, 'No se puede terminar ni cancelar la orden');
        }

        return tx.productionOrder.update({
          where: { id: order.id },
          data: {
            status,
            startedAt: status === 'IN_PROGRESS' ? new Date() : undefined,
            finishedAt: status === 'DONE' ? new Date() : undefined,
          },
        });
      });
    },
  );

  // PATCH /api/orders/:id/assign -> asigna, cambia o quita el empleado.
  // Con alguien trabajando (WorkLog abierto) no se puede: 400
  app.patch(
    '/:id/assign',
    { schema: { params: orderIdParams, body: assignEmployeeBody } },
    async (req) => {
      const { employeeId } = req.body;

      return app.db.$transaction(async (tx) => {
        const order = await lockOrder(tx, req.params.id);

        if (order.status === 'DONE' || order.status === 'CANCELLED') {
          throw new HttpError(
            400,
            `La orden está en estado "${ORDER_STATUS_LABELS[order.status]}" y no admite cambios de empleado`,
          );
        }
        if (employeeId === order.assignedEmployeeId) {
          throw new HttpError(400, 'Ese empleado ya está asignado a la orden');
        }
        await assertNoOpenWorkLog(tx, order.id, 'No se puede reasignar la orden');
        if (employeeId !== null) await checkEmployeeActive(tx, employeeId);

        return tx.productionOrder.update({
          where: { id: order.id },
          data: { assignedEmployeeId: employeeId },
          include: { assignedEmployee: { select: { id: true, code: true, name: true } } },
        });
      });
    },
  );

  // DELETE /api/orders/:id
  app.delete('/:id', { schema: { params: orderIdParams } }, async (req, reply) => {
    await app.db.productionOrder.delete({ where: { id: req.params.id } });
    return reply.code(204).send();
  });
};

export default orderRoutes;
