import type { Prisma, StopReason } from '@prisma/client';
import { lockMachine, trackMaintenance } from '../machines/machines.maintenance.js';

// Cliente de Prisma dentro de una transacción interactiva
type Tx = Prisma.TransactionClient;

// Error con código HTTP: el manejador de errores de Fastify responde con
// ese statusCode y { message }. Lanzarlo dentro de la transacción la deshace.
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

// Bloquea la fila de la orden hasta el final de la transacción: dos peticiones
// sobre la misma orden se ejecutan una detrás de otra, nunca a la vez.
// Devuelve la orden ya bloqueada o lanza 404.
export async function lockOrder(tx: Tx, orderId: number) {
  await tx.$queryRaw`SELECT id FROM "ProductionOrder" WHERE id = ${orderId} FOR UPDATE`;
  const order = await tx.productionOrder.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, quantity: true, assignedEmployeeId: true, machineId: true },
  });
  if (!order) throw new HttpError(404, 'Orden no encontrada');
  return order;
}

// Igual que lockOrder pero con el empleado: dos "iniciar" suyos sobre órdenes
// distintas no pueden colarse a la vez la comprobación de "un trabajo abierto"
export async function lockEmployee(tx: Tx, employeeId: number) {
  await tx.$queryRaw`SELECT id FROM "Employee" WHERE id = ${employeeId} FOR UPDATE`;
}

export async function checkEmployeeActive(tx: Tx, employeeId: number) {
  const employee = await tx.employee.findUnique({
    where: { id: employeeId },
    select: { code: true, active: true },
  });
  if (!employee) throw new HttpError(400, `El empleado ${employeeId} no existe`);
  if (!employee.active) throw new HttpError(400, `El empleado ${employee.code} no está activo`);
}

// El admin no toca una orden en la que alguien está trabajando: primero debe finalizar el empleado
export async function assertNoOpenWorkLog(tx: Tx, orderId: number, action: string) {
  const open = await tx.workLog.findFirst({
    where: { orderId, endedAt: null },
    select: { employee: { select: { name: true } } },
  });
  if (open) {
    throw new HttpError(400, `${action}: ${open.employee.name} está trabajando en ella`);
  }
}

type CloseWorkLogData = {
  producedQty: number;
  stopReason: StopReason;
  note: string | null;
};

// Cierra el WorkLog, recalcula producedQty de la orden (suma de sus WorkLog)
// y la pasa a DONE si llega a la cantidad pedida. Con MACHINE_ISSUE, la máquina
// de la orden pasa a MAINTENANCE y se abre su periodo de mantenimiento (si ya
// estaba en mantenimiento, sigue el periodo que tenía).
export async function closeWorkLog(
  tx: Tx,
  workLogId: number,
  order: { id: number; quantity: number; machineId: number | null },
  data: CloseWorkLogData,
) {
  const workLog = await tx.workLog.update({
    where: { id: workLogId },
    data: { ...data, endedAt: new Date() },
  });

  if (data.stopReason === 'MACHINE_ISSUE' && order.machineId !== null) {
    const machine = await lockMachine(tx, order.machineId);
    if (machine.status !== 'MAINTENANCE') {
      await trackMaintenance(tx, machine.id, 'MAINTENANCE', {
        at: workLog.endedAt!,
        workLogId: workLog.id,
      });
      await tx.machine.update({ where: { id: machine.id }, data: { status: 'MAINTENANCE' } });
    }
  }

  const { _sum } = await tx.workLog.aggregate({
    where: { orderId: order.id },
    _sum: { producedQty: true },
  });
  const producedQty = _sum.producedQty ?? 0;
  const done = producedQty >= order.quantity;

  const updatedOrder = await tx.productionOrder.update({
    where: { id: order.id },
    data: {
      producedQty,
      ...(done && { status: 'DONE', finishedAt: new Date() }),
    },
    select: { id: true, code: true, status: true, quantity: true, producedQty: true },
  });
  return { workLog, order: updatedOrder };
}
