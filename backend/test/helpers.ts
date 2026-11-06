import { afterAll, beforeAll, beforeEach } from 'vitest';
import { buildApp } from '../src/app.js';
import { hashPassword } from '../src/plugins/auth.js';
import type { Db } from '../src/plugins/prisma.js';

export type TestApp = Awaited<ReturnType<typeof buildApp>>;

export const ADMIN_EMAIL = 'admin@test.local';
export const ADMIN_PASSWORD = 'admin-test-1234';

// Vacía todas las tablas (menos la de migraciones) y reinicia los ids.
// Las tablas se leen de la BD: una tabla nueva queda incluida sin tocar esto.
export async function resetDb(db: Db) {
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const list = tables.map(({ tablename }) => `"${tablename}"`).join(', ');
  await db.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}

// Una app por archivo de test y BD vacía antes de cada test.
// Uso: const ctx = useTestApp(); ... ctx.app.inject(...)
export function useTestApp() {
  const ctx = {} as { app: TestApp };

  beforeAll(async () => {
    ctx.app = await buildApp({ logger: false });
    await ctx.app.ready();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    await resetDb(ctx.app.db);
  });

  return ctx;
}

export const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

// Crea el admin y entra por POST /api/auth/login, como el frontend
export async function createAdmin(app: TestApp) {
  const user = await app.db.user.create({
    data: {
      email: ADMIN_EMAIL,
      name: 'Admin de test',
      passwordHash: await hashPassword(ADMIN_PASSWORD),
    },
  });
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  if (res.statusCode !== 200) throw new Error(`Login de admin falló: ${res.body}`);
  return { user, token: res.json<{ token: string }>().token };
}

// Crea un empleado y firma su token directamente: el login de empleado tiene un
// límite de 5 intentos/min por IP y en los tests todas las peticiones vienen de la misma
export async function createEmployee(
  app: TestApp,
  data: { code?: string; name?: string; active?: boolean } = {},
) {
  const employee = await app.db.employee.create({
    data: { code: 'EMP-T1', name: 'Empleado de test', ...data },
  });
  const token = app.jwt.sign({ role: 'EMPLOYEE', employeeId: employee.id });
  return { employee, token };
}

export function createMachine(
  app: TestApp,
  data: { code?: string; name?: string; status?: 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE' } = {},
) {
  return app.db.machine.create({ data: { code: 'MAQ-T1', name: 'Máquina de test', ...data } });
}

export function createOrder(
  app: TestApp,
  data: {
    code?: string;
    quantity?: number;
    status?: 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
    machineId?: number;
    assignedEmployeeId?: number;
    cycleTimeSec?: number;
    producedQty?: number;
    plannedStart?: Date;
    startedAt?: Date;
    priority?: number;
  } = {},
) {
  return app.db.productionOrder.create({
    data: { code: 'OF-T1', product: 'Pieza de test', quantity: 100, ...data },
  });
}
