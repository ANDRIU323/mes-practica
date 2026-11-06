import ExcelJS from 'exceljs';
import { z } from 'zod';
import type { Db } from '../../plugins/prisma.js';
import { MACHINE_STATUS_LABELS } from '../machines/machines.schema.js';
import { createOrderBody } from './orders.schema.js';
import { HttpError } from './worklogs.js';

// Vale tanto app.db como el tx de app.db.$transaction (los dos con el omit de pinHash)
type DbModels = Pick<Db, 'productionOrder' | 'machine' | 'employee'>;

export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;
export const IMPORT_MAX_ROWS = 1000;

// Cabeceras de la plantilla, en el orden de las columnas
export const IMPORT_COLUMNS = [
  'codigo',
  'producto',
  'cantidad',
  'maquina',
  'empleado',
  'inicio_previsto',
  'ciclo_seg',
] as const;
export type ImportColumn = (typeof IMPORT_COLUMNS)[number];
const REQUIRED_COLUMNS: ImportColumn[] = ['codigo', 'producto', 'cantidad'];

export const NOT_XLSX_MESSAGE = 'El archivo debe ser un Excel .xlsx';

// Las reglas de código, producto, cantidad y fecha son las de crear una orden.
// La máquina y el empleado llegan por código y se resuelven a id contra la BD
const importRowSchema = createOrderBody
  .pick({ code: true, product: true, quantity: true, plannedStart: true, cycleTimeSec: true })
  .extend({
    machineCode: z.string().max(30).optional(),
    employeeCode: z.string().max(30).optional(),
  });

type ImportRowRaw = {
  code?: string;
  product?: string;
  quantity?: number | string;
  machineCode?: string;
  employeeCode?: string;
  plannedStart?: Date | string;
  cycleTimeSec?: number | string;
};
type ImportRowData = z.infer<typeof importRowSchema>;

const FIELD_COLUMNS: Record<keyof ImportRowData, ImportColumn> = {
  code: 'codigo',
  product: 'producto',
  quantity: 'cantidad',
  machineCode: 'maquina',
  employeeCode: 'empleado',
  plannedStart: 'inicio_previsto',
  cycleTimeSec: 'ciclo_seg',
};

// row = número de fila en Excel (la 1 son las cabeceras)
export interface ImportRowError {
  row: number;
  field: ImportColumn;
  message: string;
}

export interface ImportOrder {
  row: number;
  code: string;
  product: string;
  quantity: number;
  machineId: number | null;
  assignedEmployeeId: number | null;
  plannedStart: Date | null;
  cycleTimeSec: number | null;
}

export interface ImportResult {
  valid: ImportOrder[];
  errors: ImportRowError[];
}

interface ParsedRow {
  row: number;
  raw: ImportRowRaw;
  // null si Zod encontró errores
  data: ImportRowData | null;
  errors: ImportRowError[];
}

type PlainValue = string | number | boolean | Date | undefined;

// Valor de la celda sin envoltorios: fórmula → su resultado, texto con formato o enlace → su texto
function plainValue(value: ExcelJS.CellValue | undefined): PlainValue {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'object' || value instanceof Date) return value;
  if ('result' in value) return plainValue(value.result as ExcelJS.CellValue);
  if ('richText' in value) return value.richText.map((part) => part.text).join('');
  if ('text' in value) return plainValue(value.text);
  if ('error' in value) return value.error;
  return undefined;
}

function toText(value: PlainValue): string | undefined {
  if (value === undefined) return undefined;
  const text = (value instanceof Date ? value.toISOString().slice(0, 10) : String(value)).trim();
  return text === '' ? undefined : text;
}

// Admite "250" o "250,0" escritos como texto. Si no es un número, se deja el texto y Zod lo rechaza
function toNumber(value: PlainValue): number | string | undefined {
  if (typeof value === 'number') return value;
  const text = toText(value);
  if (text === undefined) return undefined;
  const number = Number(text.replace(',', '.'));
  return Number.isNaN(number) ? text : number;
}

// Excel guarda las fechas como días desde el 30/12/1899 (25569 = 01/01/1970)
function excelSerialToDate(serial: number) {
  return new Date(Math.round((serial - 25569) * 86_400_000));
}

// Fecha de celda, número de serie de Excel o texto dd/mm/aaaa. Otro texto se deja a
// z.coerce.date (p. ej. 2026-12-01), que da "Fecha no válida" si no lo entiende
function toDate(value: PlainValue): Date | string | undefined {
  if (value instanceof Date) return value;
  if (typeof value === 'number') return excelSerialToDate(value);
  const text = toText(value);
  if (text === undefined) return undefined;

  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (!dmy) return text;
  const [day, month, year] = [Number(dmy[1]), Number(dmy[2]), Number(dmy[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  // Date.UTC no falla con el 31/02: lo pasa a marzo. Si cambia el día, la fecha no existe
  return date.getUTCDate() === day && date.getUTCMonth() === month - 1 ? date : 'fecha inexistente';
}

// "Inicio previsto" o "Código" también valen como cabecera
function normalizeHeader(value: ExcelJS.CellValue) {
  return (toText(plainValue(value)) ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_');
}

function issueMessage(issue: z.ZodIssue, raw: ImportRowRaw) {
  const field = issue.path[0] as keyof ImportRowData;
  if (raw[field] === undefined) return 'Obligatorio';
  if (issue.code === 'too_big') return `Máximo ${issue.maximum} caracteres`;
  if (field === 'quantity') return 'Debe ser un número entero mayor que 0';
  if (field === 'plannedStart') return 'Fecha no válida (usa dd/mm/aaaa)';
  if (field === 'cycleTimeSec') return 'Debe ser un número de segundos mayor que 0';
  return issue.message;
}

// Lee la primera hoja y valida cada fila con Zod. Lo que invalida el archivo entero
// (no es .xlsx, faltan columnas, sin filas o demasiadas) lanza HttpError 400
export async function readOrdersWorkbook(buffer: Buffer): Promise<ParsedRow[]> {
  // Un .xlsx es un ZIP y todo ZIP empieza por "PK": así no se le pasa a exceljs cualquier cosa
  if (buffer.subarray(0, 2).toString('latin1') !== 'PK') throw new HttpError(400, NOT_XLSX_MESSAGE);

  const workbook = new ExcelJS.Workbook();
  try {
    // Los tipos de exceljs declaran su propio Buffer; en ejecución acepta el de Node
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw new HttpError(400, NOT_XLSX_MESSAGE);
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new HttpError(400, 'El archivo no tiene ninguna hoja');

  // Columna de Excel de cada cabecera conocida; las demás columnas se ignoran
  const columns = new Map<ImportColumn, number>();
  sheet.getRow(1).eachCell((cell, col) => {
    const header = normalizeHeader(cell.value);
    if ((IMPORT_COLUMNS as readonly string[]).includes(header)) columns.set(header as ImportColumn, col);
  });
  const missing = REQUIRED_COLUMNS.filter((column) => !columns.has(column));
  if (missing.length > 0) {
    throw new HttpError(400, `Faltan columnas en la fila 1: ${missing.join(', ')}`);
  }

  const read = (row: ExcelJS.Row, column: ImportColumn) => {
    const col = columns.get(column);
    return col === undefined ? undefined : plainValue(row.getCell(col).value);
  };

  const rows: ParsedRow[] = [];
  for (let n = 2; n <= sheet.rowCount; n++) {
    // findRow, no getRow: getRow crea la fila si no existe
    const row = sheet.findRow(n);
    if (!row) continue;

    const raw: ImportRowRaw = {
      code: toText(read(row, 'codigo')),
      product: toText(read(row, 'producto')),
      quantity: toNumber(read(row, 'cantidad')),
      machineCode: toText(read(row, 'maquina')),
      employeeCode: toText(read(row, 'empleado')),
      plannedStart: toDate(read(row, 'inicio_previsto')),
      cycleTimeSec: toNumber(read(row, 'ciclo_seg')),
    };
    if (Object.values(raw).every((value) => value === undefined)) continue;

    if (rows.length === IMPORT_MAX_ROWS) {
      throw new HttpError(400, `El archivo supera el máximo de ${IMPORT_MAX_ROWS} filas`);
    }

    const parsed = importRowSchema.safeParse(raw);
    rows.push(
      parsed.success
        ? { row: n, raw, data: parsed.data, errors: [] }
        : {
            row: n,
            raw,
            data: null,
            errors: parsed.error.issues.map((issue) => ({
              row: n,
              field: FIELD_COLUMNS[issue.path[0] as keyof ImportRowData],
              message: issueMessage(issue, raw),
            })),
          },
    );
  }

  if (rows.length === 0) throw new HttpError(400, 'El archivo no tiene filas con datos');
  return rows;
}

// Comprueba contra la BD (códigos repetidos o existentes, máquina y empleado) y
// pasa los códigos de máquina y empleado a ids. Una fila con algún error no es válida
export async function resolveOrderRows(db: DbModels, rows: ParsedRow[]): Promise<ImportResult> {
  const codesOf = (key: 'code' | 'machineCode' | 'employeeCode') => [
    ...new Set(rows.flatMap(({ raw }) => raw[key] ?? [])),
  ];

  const [existing, machines, employees] = await Promise.all([
    db.productionOrder.findMany({ where: { code: { in: codesOf('code') } }, select: { code: true } }),
    db.machine.findMany({
      where: { code: { in: codesOf('machineCode') } },
      select: { id: true, code: true, status: true },
    }),
    db.employee.findMany({
      where: { code: { in: codesOf('employeeCode') } },
      select: { id: true, code: true, active: true },
    }),
  ]);
  const existingCodes = new Set(existing.map((order) => order.code));
  const machineByCode = new Map(machines.map((machine) => [machine.code, machine]));
  const employeeByCode = new Map(employees.map((employee) => [employee.code, employee]));
  // Primera fila en la que aparece cada código del archivo
  const firstRowByCode = new Map<string, number>();

  const result: ImportResult = { valid: [], errors: [] };

  for (const { row, raw, data, errors: zodErrors } of rows) {
    const errors = [...zodErrors];
    const add = (field: ImportColumn, message: string) => errors.push({ row, field, message });

    if (raw.code !== undefined) {
      const firstRow = firstRowByCode.get(raw.code);
      if (firstRow !== undefined) {
        add('codigo', `Código repetido en el archivo (ya está en la fila ${firstRow})`);
      } else {
        firstRowByCode.set(raw.code, row);
        if (existingCodes.has(raw.code)) add('codigo', `Ya existe una orden con el código ${raw.code}`);
      }
    }

    let machineId: number | null = null;
    if (raw.machineCode !== undefined) {
      const machine = machineByCode.get(raw.machineCode);
      if (!machine) {
        add('maquina', `No existe la máquina ${raw.machineCode}`);
      } else if (machine.status !== 'ACTIVE') {
        const label = MACHINE_STATUS_LABELS[machine.status];
        add('maquina', `La máquina ${machine.code} está en estado "${label}" y no admite órdenes`);
      } else {
        machineId = machine.id;
      }
    }

    let assignedEmployeeId: number | null = null;
    if (raw.employeeCode !== undefined) {
      const employee = employeeByCode.get(raw.employeeCode);
      if (!employee) add('empleado', `No existe el empleado ${raw.employeeCode}`);
      else if (!employee.active) add('empleado', `El empleado ${employee.code} está desactivado`);
      else assignedEmployeeId = employee.id;
    }

    if (errors.length > 0 || !data) {
      result.errors.push(...errors);
    } else {
      result.valid.push({
        row,
        code: data.code,
        product: data.product,
        quantity: data.quantity,
        machineId,
        assignedEmployeeId,
        plannedStart: data.plannedStart ?? null,
        cycleTimeSec: data.cycleTimeSec ?? null,
      });
    }
  }

  return result;
}

// Plantilla: cabeceras en negrita y una fila de ejemplo
export async function buildImportTemplate() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Órdenes');
  sheet.columns = IMPORT_COLUMNS.map((header) => ({ header, key: header, width: 18 }));
  sheet.getRow(1).font = { bold: true };
  sheet.addRow({
    codigo: 'OF-2026-0100',
    producto: 'Eje 20mm',
    cantidad: 250,
    maquina: 'MAQ-01',
    empleado: 'EMP-01',
    inicio_previsto: new Date(Date.UTC(2026, 11, 1)),
    ciclo_seg: 45,
  });
  sheet.getColumn('inicio_previsto').numFmt = 'dd/mm/yyyy';
  return workbook.xlsx.writeBuffer();
}
