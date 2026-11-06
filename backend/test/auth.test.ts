import { describe, expect, it } from 'vitest';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  bearer,
  createAdmin,
  createEmployee,
  useTestApp,
} from './helpers.js';

const ctx = useTestApp();

describe('POST /api/auth/login', () => {
  it('con credenciales correctas devuelve token y usuario sin passwordHash', async () => {
    await createAdmin(ctx.app);

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.token).toEqual(expect.any(String));
    expect(body.user).toMatchObject({ email: ADMIN_EMAIL, role: 'ADMIN' });
    expect(body.user).not.toHaveProperty('passwordHash');
  });

  it('con contraseña incorrecta da 401', async () => {
    await createAdmin(ctx.app);

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: ADMIN_EMAIL, password: 'no-es-esta' },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json()).not.toHaveProperty('token');
  });
});

describe('Rutas protegidas', () => {
  it('sin token da 401', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/machines' });
    expect(res.statusCode).toBe(401);
  });

  it('con un token mal firmado da 401', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/machines',
      headers: bearer('no.es.un-token'),
    });
    expect(res.statusCode).toBe(401);
  });

  it('un empleado en una ruta de admin da 403', async () => {
    const { token } = await createEmployee(ctx.app);

    const res = await ctx.app.inject({ method: 'GET', url: '/api/machines', headers: bearer(token) });

    expect(res.statusCode).toBe(403);
  });

  it('un admin en una ruta de planta da 403', async () => {
    const { token } = await createAdmin(ctx.app);

    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/shopfloor/orders',
      headers: bearer(token),
    });

    expect(res.statusCode).toBe(403);
  });
});
