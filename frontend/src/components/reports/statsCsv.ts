import type { DashboardStats } from '../../types/dashboard';
import { downloadBlob } from '../../utils/downloadBlob';
import { STOP_REASON_CONFIG } from '../worklogs/stopReason';

// Separador ";" y coma decimal: es lo que espera Excel en español al abrir un CSV
const SEPARATOR = ';';

const decimal = (n: number) => String(n).replace('.', ',');

// Entre comillas solo si el texto contiene el separador, comillas o saltos de línea
function escapeCell(value: string) {
  return /[";\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

// Una sola tabla: empleados, máquinas y motivos de parada, distinguidos por "Tipo"
export function statsToCsv(stats: DashboardStats): string {
  const header = ['Tipo', 'Código', 'Nombre', 'Horas', 'Unidades', 'Minutos parados'];
  const rows: string[][] = [
    ...stats.employees.map(({ employee, hours, units }) => [
      'Empleado',
      employee.code,
      employee.name,
      decimal(hours),
      String(units),
      '',
    ]),
    ...stats.machines.map(({ machine, hours, units }) => [
      'Máquina',
      machine.code,
      machine.name,
      decimal(hours),
      String(units),
      '',
    ]),
    ...stats.stoppedMinutes.map(({ reason, minutes }) => [
      'Motivo de parada',
      reason,
      STOP_REASON_CONFIG[reason].label,
      '',
      '',
      String(minutes),
    ]),
  ];
  return [header, ...rows].map((row) => row.map(escapeCell).join(SEPARATOR)).join('\r\n');
}

// Genera el archivo en el navegador y lo descarga.
// El BOM (﻿) hace que Excel lea bien las tildes (UTF-8).
export function downloadCsv(filename: string, csv: string) {
  downloadBlob(filename, new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }));
}
