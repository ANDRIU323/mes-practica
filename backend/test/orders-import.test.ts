import ExcelJS from 'exceljs';
import { beforeEach, describe, expect, it } from 'vitest';
import { IMPORT_COLUMNS } from '../src/modules/orders/orders.import.js';
import {
  bearer,
  createAdmin,
  createEmployee,
  createMachine,
  createOrder,
  useTestApp,
} from './helpers.js';

const ctx = useTestApp();
let adminToken: string;

beforeEach(async () => {
  ({ token: adminToken } = await createAdmin(ctx.app));
});

// Excel en memoria con las cabeceras en la fila 1. Cada array es una fila desde la 2; [] = fila vacía
async function xlsx(rows: unknown[][]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Órdenes');
  sheet.addRow([...IMPORT_COLUMNS]);
  rows.forEach((values, i) => {
    sheet.getRow(i + 2).values = values as ExcelJS.CellValue[];
  });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

// app.inject no monta multipart por sí solo: el body se escribe a mano
function upload(url: string, file: Buffer, filename = 'ordenes.xlsx') {
  const boundary = '----mes-test-boundary';
  const payload = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
        'Content-Type: application/octet-stream\r\n\r\n',
    ),
    file,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return ctx.app.inject({
    method: 'POST',
    url,
    headers: { ...bearer(adminToken), 'content-type': `multipart/form-data; boundary=${boundary}` },
    payload,
  });
}

const countOrders = () => ctx.app.db.productionOrder.count();

describe('importar órdenes desde Excel', () => {
  it('archivo válido: la vista previa no guarda nada y la importación crea todas las órdenes', async () => {
    const machine = await createMachine(ctx.app);
    const { employee } = await createEmployee(ctx.app);
    const file = await xlsx([
      ['OF-1', 'Pieza A', 10, 'MAQ-T1', 'EMP-T1', new Date(Date.UTC(2026, 11, 1)), 45],
      [],
      ['OF-2', 'Pieza B', '20', null, null, '15/12/2026', '2,5'],
    ]);

    const preview = await upload('/api/orders/import/preview', file);
    expect(preview.statusCode).toBe(200);
    expect(preview.json().errors).toEqual([]);
    // La fila vacía se ignora pero cuenta para el número de fila
    expect(preview.json().valid.map((o: { row: number }) => o.row)).toEqual([2, 4]);
    expect(await countOrders()).toBe(0);

    const res = await upload('/api/orders/import', file);
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ created: 2 });

    const orders = await ctx.app.db.productionOrder.findMany({ orderBy: { code: 'asc' } });
    expect(orders).toMatchObject([
      {
        code: 'OF-1',
        quantity: 10,
        machineId: machine.id,
        assignedEmployeeId: employee.id,
        plannedStart: new Date('2026-12-01T00:00:00Z'),
        cycleTimeSec: 45,
      },
      {
        code: 'OF-2',
        quantity: 20,
        machineId: null,
        assignedEmployeeId: null,
        plannedStart: new Date('2026-12-15T00:00:00Z'),
        cycleTimeSec: 2.5,
      },
    ]);
  });

  it('filas con error: cada error con su fila y campo, y no se importa ninguna', async () => {
    await createMachine(ctx.app, { code: 'MAQ-M', status: 'MAINTENANCE' });
    await createEmployee(ctx.app, { code: 'EMP-X', active: false });
    const file = await xlsx([
      ['OF-1', null, -5],
      ['OF-2', 'Pieza', 5, 'MAQ-M'],
      ['OF-3', 'Pieza', 5, 'NO-EXISTE', 'EMP-X'],
      ['OF-4', 'Pieza', 5, null, null, null, 0],
      ['OF-5', 'Pieza', 5],
    ]);

    const preview = await upload('/api/orders/import/preview', file);
    expect(preview.statusCode).toBe(200);
    expect(preview.json().valid).toHaveLength(1);
    expect(preview.json().errors).toEqual([
      { row: 2, field: 'producto', message: 'Obligatorio' },
      { row: 2, field: 'cantidad', message: 'Debe ser un número entero mayor que 0' },
      { row: 3, field: 'maquina', message: expect.stringMatching(/Mantenimiento/) },
      { row: 4, field: 'maquina', message: 'No existe la máquina NO-EXISTE' },
      { row: 4, field: 'empleado', message: 'El empleado EMP-X está desactivado' },
      { row: 5, field: 'ciclo_seg', message: 'Debe ser un número de segundos mayor que 0' },
    ]);

    const res = await upload('/api/orders/import', file);
    expect(res.statusCode).toBe(400);
    expect(res.json().errors).toHaveLength(6);
    expect(await countOrders()).toBe(0);
  });

  it('código repetido en el archivo o que ya existe en la BD', async () => {
    await createOrder(ctx.app, { code: 'OF-T1' });
    const file = await xlsx([
      ['OF-1', 'Pieza', 5],
      ['OF-1', 'Pieza', 5],
      ['OF-T1', 'Pieza', 5],
    ]);

    const res = await upload('/api/orders/import', file);

    expect(res.statusCode).toBe(400);
    expect(res.json().errors).toEqual([
      { row: 3, field: 'codigo', message: 'Código repetido en el archivo (ya está en la fila 2)' },
      { row: 4, field: 'codigo', message: 'Ya existe una orden con el código OF-T1' },
    ]);
    expect(await countOrders()).toBe(1);
  });

  it('rechaza archivos que no son .xlsx, aunque se renombren', async () => {
    const csv = Buffer.from('codigo;producto;cantidad\nOF-1;Pieza;5\n');

    const byName = await upload('/api/orders/import/preview', csv, 'ordenes.csv');
    expect(byName.statusCode).toBe(400);
    expect(byName.json().message).toBe('El archivo debe ser un Excel .xlsx');

    const renamed = await upload('/api/orders/import/preview', csv, 'ordenes.xlsx');
    expect(renamed.statusCode).toBe(400);
    expect(renamed.json().message).toBe('El archivo debe ser un Excel .xlsx');
  });

  it('la plantilla se descarga y su fila de ejemplo es válida', async () => {
    await createMachine(ctx.app, { code: 'MAQ-01' });
    await createEmployee(ctx.app, { code: 'EMP-01' });

    const template = await ctx.app.inject({
      method: 'GET',
      url: '/api/orders/import/template',
      headers: bearer(adminToken),
    });
    expect(template.statusCode).toBe(200);
    expect(template.headers['content-disposition']).toContain('plantilla-ordenes.xlsx');

    const preview = await upload('/api/orders/import/preview', template.rawPayload);
    expect(preview.json()).toMatchObject({ errors: [], valid: [{ row: 2, code: 'OF-2026-0100' }] });
  });
});

describe('GET /api/orders/export', () => {
  async function readExport(url: string) {
    const res = await ctx.app.inject({ method: 'GET', url, headers: bearer(adminToken) });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-disposition']).toContain('ordenes.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(res.rawPayload as unknown as ExcelJS.Buffer);
    return { payload: res.rawPayload, sheet: workbook.worksheets[0] };
  }

  it('respeta el filtro de estado y exporta códigos de máquina y empleado', async () => {
    const machine = await createMachine(ctx.app, { code: 'MAQ-01' });
    const { employee } = await createEmployee(ctx.app, { code: 'EMP-01' });
    await createOrder(ctx.app, {
      code: 'OF-1',
      status: 'IN_PROGRESS',
      machineId: machine.id,
      assignedEmployeeId: employee.id,
    });
    await createOrder(ctx.app, { code: 'OF-2', status: 'DONE' });

    const { sheet } = await readExport('/api/orders/export?status=IN_PROGRESS');
    expect(sheet.rowCount).toBe(2);
    // Las keys de columna no se guardan en el archivo: se busca por cabecera
    const headers = sheet.getRow(1).values as string[];
    const cell = (header: string) => sheet.getRow(2).getCell(headers.indexOf(header)).value;
    expect(cell('codigo')).toBe('OF-1');
    expect(cell('maquina')).toBe('MAQ-01');
    expect(cell('empleado')).toBe('EMP-01');
    expect(cell('estado')).toBe('En curso');
  });

  it('exporta los instantes en hora de Madrid', async () => {
    const order = await createOrder(ctx.app, { code: 'OF-1' });
    // 1 de julio 10:30 UTC = 12:30 en Madrid (verano); 15 de enero 10:30 UTC = 11:30 (invierno)
    await ctx.app.db.productionOrder.update({
      where: { id: order.id },
      data: {
        startedAt: new Date('2026-07-01T10:30:00Z'),
        createdAt: new Date('2026-01-15T10:30:00Z'),
      },
    });

    const { sheet } = await readExport('/api/orders/export');
    const headers = sheet.getRow(1).values as string[];
    const cell = (header: string) => sheet.getRow(2).getCell(headers.indexOf(header)).value as Date;
    expect(cell('inicio').toISOString()).toBe('2026-07-01T12:30:00.000Z');
    expect(cell('creada').toISOString()).toBe('2026-01-15T11:30:00.000Z');
  });

  it('el archivo exportado se puede volver a importar', async () => {
    await createMachine(ctx.app, { code: 'MAQ-01' });
    const order = await createOrder(ctx.app, { code: 'OF-1' });
    const { payload } = await readExport('/api/orders/export');

    await ctx.app.db.productionOrder.delete({ where: { id: order.id } });
    const preview = await upload('/api/orders/import/preview', payload);
    expect(preview.json()).toMatchObject({ errors: [], valid: [{ row: 2, code: 'OF-1' }] });
  });
});
