import type { MachineStatus } from '../../types/machine';

// Compartido por el Badge y el Select del formulario
export const MACHINE_STATUS_CONFIG: Record<MachineStatus, { label: string; color: string }> = {
  ACTIVE: { label: 'Activa', color: 'green' },
  MAINTENANCE: { label: 'Mantenimiento', color: 'yellow' },
  INACTIVE: { label: 'Inactiva', color: 'gray' },
};
