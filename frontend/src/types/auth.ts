export type Role = 'ADMIN' | 'EMPLOYEE';

export interface AdminUser {
  id: number;
  email: string;
  name: string;
  role: 'ADMIN';
}

// id = Employee.id
export interface EmployeeUser {
  id: number;
  code: string;
  name: string;
  role: 'EMPLOYEE';
}

// Comprobando role, TypeScript sabe qué campos tiene
export type User = AdminUser | EmployeeUser;

export interface LoginInput {
  email: string;
  password: string;
}

export interface EmployeeLoginInput {
  code: string;
  pin: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}
