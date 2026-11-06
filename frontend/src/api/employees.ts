import type { Employee, EmployeeStats, EmployeeWithTotals } from '../types/employee';
import { apiFetch } from './client';

export interface CreateEmployeeInput {
  code: string;
  name: string;
  active?: boolean;
}

export type UpdateEmployeeInput = Partial<CreateEmployeeInput>;

export function getEmployees(): Promise<EmployeeWithTotals[]> {
  return apiFetch<EmployeeWithTotals[]>('/employees');
}

export function getEmployeeStats(id: number): Promise<EmployeeStats> {
  return apiFetch<EmployeeStats>(`/employees/${id}/stats`);
}

export function createEmployee(data: CreateEmployeeInput): Promise<Employee> {
  return apiFetch<Employee>('/employees', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateEmployee(id: number, data: UpdateEmployeeInput): Promise<Employee> {
  return apiFetch<Employee>(`/employees/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// También quita el bloqueo por intentos fallidos
export function setEmployeePin(id: number, pin: string): Promise<void> {
  return apiFetch<void>(`/employees/${id}/pin`, {
    method: 'PUT',
    body: JSON.stringify({ pin }),
  });
}

export function deleteEmployee(id: number): Promise<void> {
  return apiFetch<void>(`/employees/${id}`, { method: 'DELETE' });
}
