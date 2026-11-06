import type { StopReason } from '../../types/worklog';

// Compartido por el detalle de empleado y el modal de finalizar de planta
export const STOP_REASON_CONFIG: Record<StopReason, { label: string; color: string }> = {
  END_OF_SHIFT: { label: 'Fin de jornada', color: 'gray' },
  BREAK: { label: 'Descanso', color: 'blue' },
  MACHINE_ISSUE: { label: 'Incidencia', color: 'red' },
  LINE_CHANGE: { label: 'Cambio de línea', color: 'violet' },
};

export const STOP_REASONS = Object.keys(STOP_REASON_CONFIG) as StopReason[];
