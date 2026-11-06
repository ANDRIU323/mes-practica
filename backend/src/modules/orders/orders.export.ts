import ExcelJS from 'exceljs';
import type { Db } from '../../plugins/prisma.js';
import { toLocalWallClock } from '../shifts/shifts.time.js';
import { IMPORT_COLUMNS } from './orders.import.js';
import { ORDER_STATUS_LABELS, type OrderStatus } from './orders.schema.js';

// Después de las columnas de la plantilla (así el archivo se puede volver a importar)
const EXTRA_COLUMNS = ['estado', 'producido', 'inicio', 'fin', 'creada'] as const;

export async function buildOrdersExport(
  db: Pick<Db, 'productionOrder'>,
  filters: { status?: OrderStatus; machineId?: number },
) {
  const orders = await db.productionOrder.findMany({
    where: filters,
    include: {
      machine: { select: { code: true } },
      assignedEmployee: { select: { code: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Órdenes');
  sheet.columns = [...IMPORT_COLUMNS, ...EXTRA_COLUMNS].map((header) => ({
    header,
    key: header,
    width: 18,
  }));
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  // Instantes en hora de la planta. `inicio_previsto` no: es un día (medianoche UTC, como al importar)
  const local = (instant: Date | null) => (instant ? toLocalWallClock(instant) : undefined);

  for (const order of orders) {
    sheet.addRow({
      codigo: order.code,
      producto: order.product,
      cantidad: order.quantity,
      maquina: order.machine?.code,
      empleado: order.assignedEmployee?.code,
      inicio_previsto: order.plannedStart ?? undefined,
      ciclo_seg: order.cycleTimeSec ?? undefined,
      estado: ORDER_STATUS_LABELS[order.status],
      producido: order.producedQty,
      inicio: local(order.startedAt),
      fin: local(order.finishedAt),
      creada: local(order.createdAt),
    });
  }

  sheet.getColumn('inicio_previsto').numFmt = 'dd/mm/yyyy';
  for (const key of ['inicio', 'fin', 'creada']) sheet.getColumn(key).numFmt = 'dd/mm/yyyy hh:mm';
  return workbook.xlsx.writeBuffer();
}
