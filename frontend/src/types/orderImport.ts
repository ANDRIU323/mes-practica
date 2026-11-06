// Cabeceras del Excel; el campo de cada error es una de ellas
export type ImportColumn =
  | 'codigo'
  | 'producto'
  | 'cantidad'
  | 'maquina'
  | 'empleado'
  | 'inicio_previsto';

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
  plannedStart: string | null;
  cycleTimeSec: number | null;
}

export interface OrdersImportPreview {
  valid: ImportOrder[];
  errors: ImportRowError[];
}

export interface OrdersImportResult {
  created: number;
}
