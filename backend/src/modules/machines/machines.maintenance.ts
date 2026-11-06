import type { MachineStatus, Prisma } from '@prisma/client';
import { HttpError } from '../orders/worklogs.js';

type Tx = Prisma.TransactionClient;

// Bloquea la fila de la máquina hasta el final de la transacción. Si también se
// bloquea la orden, lockOrder va antes (mismo orden siempre, sin interbloqueos).
export async function lockMachine(tx: Tx, machineId: number) {
  await tx.$queryRaw`SELECT id FROM "Machine" WHERE id = ${machineId} FOR UPDATE`;
  const machine = await tx.machine.findUnique({
    where: { id: machineId },
    select: { id: true, status: true },
  });
  if (!machine) throw new HttpError(404, 'Máquina no encontrada');
  return machine;
}

// Mantiene el historial al cambiar el estado (llamar con la máquina bloqueada y
// antes de actualizar su status): pasar a MAINTENANCE abre un periodo si no hay
// uno abierto; pasar a otro estado cierra el abierto.
export async function trackMaintenance(
  tx: Tx,
  machineId: number,
  status: MachineStatus,
  { at = new Date(), workLogId = null }: { at?: Date; workLogId?: number | null } = {},
) {
  if (status === 'MAINTENANCE') {
    const open = await tx.machineMaintenance.findFirst({
      where: { machineId, endedAt: null },
      select: { id: true },
    });
    if (!open) await tx.machineMaintenance.create({ data: { machineId, workLogId, startedAt: at } });
  } else {
    await tx.machineMaintenance.updateMany({
      where: { machineId, endedAt: null },
      data: { endedAt: at },
    });
  }
}
