import { describe, expect, it } from 'vitest';
import { hashPassword } from '../src/plugins/auth.js';
import { LOCK_WINDOW_MS, MAX_FAILED_LOGINS, stateAfterFailure } from '../src/modules/auth/loginLock.js';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  bearer,
  createAdmin,
  createEmployee,
  useTestApp,
  type TestApp,
} from './helpers.js';

const ctx = useTestApp();

// El login de empleado tiene un límite de 5/min por IP: cada petición sale de una IP distinta
// para que lo que se pruebe sea el bloqueo de la cuenta y no el rate limit
let ipCounter = 0;
const nextIp = () => `10.0.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`;

function adminLogin(app: TestApp, password: string) {
  return app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: ADMIN_EMAIL, password },
  });
}

function employeeLogin(app: TestApp, code: string, pin: string) {
  return app.inject({
    method: 'POST',
    url: '/api/auth/employee-login',
    payload: { code, pin },
    remoteAddress: nextIp(),
  });
}

async function createEmployeeWithPin(app: TestApp, pin = '1234') {
  const { employee } = await createEmployee(app);
  await app.db.employee.update({ where: { id: employee.id }, data: { pinHash: await hashPassword(pin) } });
  return employee;
}

describe('stateAfterFailure', () => {
  const now = new Date('2026-11-05T10:00:00Z');
  const clean = { failedLoginAttempts: 0, firstFailedLoginAt: null, lockedUntil: null };

  it('el primer fallo abre la ventana', () => {
    expect(stateAfterFailure(clean, now)).toEqual({ failedLoginAttempts: 1, firstFailedLoginAt: now, lockedUntil: null });
  });

  it('un fallo fuera de la ventana empieza de cero', () => {
    const old = new Date(now.getTime() - LOCK_WINDOW_MS - 1);
    const next = stateAfterFailure({ ...clean, failedLoginAttempts: 4, firstFailedLoginAt: old }, now);
    expect(next).toEqual({ failedLoginAttempts: 1, firstFailedLoginAt: now, lockedUntil: null });
  });

  it('el último fallo permitido bloquea 1 hora y reinicia el contador', () => {
    const first = new Date(now.getTime() - 60_000);
    const next = stateAfterFailure({ ...clean, failedLoginAttempts: MAX_FAILED_LOGINS - 1, firstFailedLoginAt: first }, now);
    expect(next).toEqual({
      failedLoginAttempts: 0,
      firstFailedLoginAt: null,
      lockedUntil: new Date(now.getTime() + LOCK_WINDOW_MS),
    });
  });
});

describe('Bloqueo del login de admin', () => {
  it('al 5.º fallo da 423 y después ni la contraseña correcta entra', async () => {
    await createAdmin(ctx.app);

    for (let i = 1; i < MAX_FAILED_LOGINS; i++) {
      expect((await adminLogin(ctx.app, 'mala')).statusCode).toBe(401);
    }
    const locked = await adminLogin(ctx.app, 'mala');
    expect(locked.statusCode).toBe(423);
    expect(locked.json().lockedUntil).toEqual(expect.any(String));

    expect((await adminLogin(ctx.app, ADMIN_PASSWORD)).statusCode).toBe(423);
  });

  it('pasado el bloqueo entra y limpia el contador', async () => {
    const { user } = await createAdmin(ctx.app);
    await ctx.app.db.user.update({
      where: { id: user.id },
      data: { lockedUntil: new Date(Date.now() - 1000), failedLoginAttempts: 2, firstFailedLoginAt: new Date() },
    });

    expect((await adminLogin(ctx.app, ADMIN_PASSWORD)).statusCode).toBe(200);
    const saved = await ctx.app.db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(saved).toMatchObject({ failedLoginAttempts: 0, firstFailedLoginAt: null, lockedUntil: null });
  });

  it('los fallos de hace más de 1 hora no cuentan', async () => {
    const { user } = await createAdmin(ctx.app);
    await ctx.app.db.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 4, firstFailedLoginAt: new Date(Date.now() - 2 * LOCK_WINDOW_MS) },
    });

    expect((await adminLogin(ctx.app, 'mala')).statusCode).toBe(401);
    const saved = await ctx.app.db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(saved.failedLoginAttempts).toBe(1);
  });

  it('un email inexistente siempre da 401', async () => {
    for (let i = 0; i <= MAX_FAILED_LOGINS; i++) {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'nadie@test.local', password: 'mala' },
      });
      expect(res.statusCode).toBe(401);
    }
  });
});

describe('Bloqueo del login de empleado', () => {
  it('se bloquea aunque cada intento venga de una IP distinta', async () => {
    const employee = await createEmployeeWithPin(ctx.app);

    for (let i = 1; i < MAX_FAILED_LOGINS; i++) {
      expect((await employeeLogin(ctx.app, employee.code, '0000')).statusCode).toBe(401);
    }
    expect((await employeeLogin(ctx.app, employee.code, '0000')).statusCode).toBe(423);
    expect((await employeeLogin(ctx.app, employee.code, '1234')).statusCode).toBe(423);
  });

  it('el admin le pone un PIN nuevo y vuelve a poder entrar', async () => {
    const { token } = await createAdmin(ctx.app);
    const employee = await createEmployeeWithPin(ctx.app);
    await ctx.app.db.employee.update({
      where: { id: employee.id },
      data: { lockedUntil: new Date(Date.now() + LOCK_WINDOW_MS) },
    });

    const res = await ctx.app.inject({
      method: 'PUT',
      url: `/api/employees/${employee.id}/pin`,
      headers: bearer(token),
      payload: { pin: '9876' },
    });
    expect(res.statusCode).toBe(204);

    expect((await employeeLogin(ctx.app, employee.code, '1234')).statusCode).toBe(401);
    expect((await employeeLogin(ctx.app, employee.code, '9876')).statusCode).toBe(200);
  });
});

describe('PUT /api/employees/:id/pin', () => {
  it('valida el PIN, da 404 si no existe y un empleado no puede usarlo', async () => {
    const { token } = await createAdmin(ctx.app);
    const employee = await createEmployeeWithPin(ctx.app);
    const { token: employeeToken } = await createEmployee(ctx.app, { code: 'EMP-T2' });
    const put = (id: number, pin: string, headers = bearer(token)) =>
      ctx.app.inject({ method: 'PUT', url: `/api/employees/${id}/pin`, headers, payload: { pin } });

    expect((await put(employee.id, '12a4')).statusCode).toBe(400);
    expect((await put(9999, '1234')).statusCode).toBe(404);
    expect((await put(employee.id, '1234', bearer(employeeToken))).statusCode).toBe(403);
  });

  it('GET /api/employees dice si tiene PIN sin devolver el hash', async () => {
    const { token } = await createAdmin(ctx.app);
    await createEmployeeWithPin(ctx.app);
    await createEmployee(ctx.app, { code: 'EMP-T2' });

    const res = await ctx.app.inject({ method: 'GET', url: '/api/employees', headers: bearer(token) });

    const list = res.json<{ code: string; hasPin: boolean }[]>();
    expect(list.map(({ code, hasPin }) => ({ code, hasPin }))).toEqual([
      { code: 'EMP-T1', hasPin: true },
      { code: 'EMP-T2', hasPin: false },
    ]);
    expect(list[0]).not.toHaveProperty('pinHash');
  });
});

describe('POST /api/auth/password', () => {
  const changePassword = (token: string, currentPassword: string, newPassword: string) =>
    ctx.app.inject({
      method: 'POST',
      url: '/api/auth/password',
      headers: bearer(token),
      payload: { currentPassword, newPassword },
    });

  it('cambia la contraseña: la vieja deja de valer', async () => {
    const { token } = await createAdmin(ctx.app);

    expect((await changePassword(token, ADMIN_PASSWORD, 'nueva-clave-123')).statusCode).toBe(204);
    expect((await adminLogin(ctx.app, ADMIN_PASSWORD)).statusCode).toBe(401);
    expect((await adminLogin(ctx.app, 'nueva-clave-123')).statusCode).toBe(200);
  });

  it('con la actual incorrecta da 400 y cuenta como fallo', async () => {
    const { user, token } = await createAdmin(ctx.app);

    expect((await changePassword(token, 'mala', 'nueva-clave-123')).statusCode).toBe(400);
    const saved = await ctx.app.db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(saved.failedLoginAttempts).toBe(1);
  });

  it('rechaza una nueva corta o igual a la actual', async () => {
    const { token } = await createAdmin(ctx.app);

    expect((await changePassword(token, ADMIN_PASSWORD, 'corta')).statusCode).toBe(400);
    expect((await changePassword(token, ADMIN_PASSWORD, ADMIN_PASSWORD)).statusCode).toBe(400);
  });

  it('un empleado no puede usarla', async () => {
    const { token } = await createEmployee(ctx.app);
    expect((await changePassword(token, 'x', 'nueva-clave-123')).statusCode).toBe(403);
  });
});
