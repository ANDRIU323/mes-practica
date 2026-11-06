import type { Employee } from '../../types/employee';

export function isEmployeeLocked(employee: Employee, now = Date.now()) {
  return employee.lockedUntil !== null && new Date(employee.lockedUntil).getTime() > now;
}
