// Claves de TanStack Query compartidas por todos los hooks.
// invalidateQueries compara por prefijo: invalidar una clave refresca también
// todas las que empiezan por ella.

// Listas filtradas (['orders', { status }]) y resumen del dashboard (['orders', 'summary'])
export const ORDERS_KEY = ['orders'];
// Cuelga de ORDERS_KEY: todo lo que refresca las órdenes refresca también la planificación
export const PLANNING_KEY = [...ORDERS_KEY, 'planning'];

// Lista de máquinas y detalle de cada una en un rango de días
export const MACHINES_KEY = ['machines'];
export const machineDetailKey = (id: number, from: string, to: string) => [...MACHINES_KEY, id, 'detail', { from, to }];

// Lista de empleados con totales y stats de cada uno
export const EMPLOYEES_KEY = ['employees'];
export const employeeStatsKey = (id: number) => [...EMPLOYEES_KEY, id, 'stats'];

// Planta en vivo e incidencias del dashboard (las refresca useRealtime)
export const DASHBOARD_KEY = ['dashboard'];
export const DASHBOARD_LIVE_KEY = [...DASHBOARD_KEY, 'live'];
export const DASHBOARD_INCIDENTS_KEY = [...DASHBOARD_KEY, 'incidents'];
export const dashboardStatsKey = (from: string, to: string) => [...DASHBOARD_KEY, 'stats', { from, to }];
export const dashboardOeeKey = (from: string, to: string) => [...DASHBOARD_KEY, 'oee', { from, to }];

// Turnos de un día (null = el del turno actual) e informe de cada turno
export const SHIFTS_KEY = ['shifts'];
export const shiftsListKey = (day: string | null) => [...SHIFTS_KEY, 'list', day];
export const shiftReportKey = (date: string, type: string) => [...SHIFTS_KEY, 'report', date, type];

// Órdenes del empleado en planta (solo existe en sesiones EMPLOYEE)
export const SHOPFLOOR_KEY = ['shopfloor', 'orders'];
