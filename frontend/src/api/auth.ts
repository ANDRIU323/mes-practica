import type { ChangePasswordInput, EmployeeLoginInput, LoginInput, LoginResponse } from '../types/auth';
import { apiFetch } from './client';

export function login(data: LoginInput): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function employeeLogin(data: EmployeeLoginInput): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/auth/employee-login', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function changePassword(data: ChangePasswordInput): Promise<void> {
  return apiFetch<void>('/auth/password', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
