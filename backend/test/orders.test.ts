import { beforeEach, describe, expect, it } from 'vitest';
import {
  bearer,
  createAdmin,
  createEmployee,
  createMachine,
  createOrder,
  useTestApp,
} from './helpers.js';

const ctx = useTestApp();
let adminToken: string;

// useTestApp vacía la BD en su beforeEach, que se registra antes y por eso se ejecuta antes
beforeEach(async () => {
  ({ token: adminToken } = await createAdmin(ctx.app));
});

describe('PATCH /api/orders/:id/status', () => {
  it('PENDING → IN_PROGRESS cambia el estado y guarda startedAt', async () => {
    const order = await createOrder(ctx.app);

    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/orders/${order.id}/status`,
      headers: bearer(adminToken),
      payload: { status: 'IN_PROGRESS' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'IN_PROGRESS', startedAt: expect.any(String) });
  });

  it('PENDING → DONE no está permitida: 400 y la orden no cambia', async () => {
    const order = await createOrder(ctx.app);

    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/orders/${order.id}/status`,
      headers: bearer(adminToken),
      payload: { status: 'DONE' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().message).toMatch(/No se puede pasar/);
    const saved = await ctx.app.db.productionOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(saved.status).toBe('PENDING');
  });

  it('desde DONE no se puede volver a PENDING', async () => {
    const order = await createOrder(ctx.app, { status: 'DONE' });

    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/orders/${order.id}/status`,
      headers: bearer(adminToken),
      payload: { status: 'PENDING' },
    });

    expect(res.statusCode).toBe(400);
  });
});

describe('Máquina en mantenimiento', () => {
  it('crear una orden en ella da 400', async () => {
    const machine = await createMachine(ctx.app, { status: 'MAINTENANCE' });

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: bearer(adminToken),
      payload: { code: 'OF-NUEVA', product: 'Eje', quantity: 10, machineId: machine.id },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().message).toMatch(/no admite órdenes/);
    expect(await ctx.app.db.productionOrder.count()).toBe(0);
  });

  it('mover una orden a ella da 400', async () => {
    const machine = await createMachine(ctx.app, { status: 'MAINTENANCE' });
    const order = await createOrder(ctx.app);

    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/orders/${order.id}`,
      headers: bearer(adminToken),
      payload: { machineId: machine.id },
    });

    expect(res.statusCode).toBe(400);
  });
});

describe('PATCH /api/orders/:id/assign', () => {
  it('con un trabajo abierto no se puede reasignar: 400 y sigue el mismo empleado', async () => {
    const { employee: ana, token: anaToken } = await createEmployee(ctx.app, { code: 'EMP-A' });
    const { employee: luis } = await createEmployee(ctx.app, { code: 'EMP-L' });
    const order = await createOrder(ctx.app, { assignedEmployeeId: ana.id });

    // Ana empieza a trabajar desde planta
    const start = await ctx.app.inject({
      method: 'POST',
      url: `/api/shopfloor/orders/${order.id}/start`,
      headers: bearer(anaToken),
    });
    expect(start.statusCode).toBe(201);

    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/orders/${order.id}/assign`,
      headers: bearer(adminToken),
      payload: { employeeId: luis.id },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().message).toMatch(/está trabajando/);
    const saved = await ctx.app.db.productionOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(saved.assignedEmployeeId).toBe(ana.id);
  });

  it('sin trabajo abierto sí se puede reasignar', async () => {
    const { employee: ana } = await createEmployee(ctx.app, { code: 'EMP-A' });
    const { employee: luis } = await createEmployee(ctx.app, { code: 'EMP-L' });
    const order = await createOrder(ctx.app, { assignedEmployeeId: ana.id });

    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/orders/${order.id}/assign`,
      headers: bearer(adminToken),
      payload: { employeeId: luis.id },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().assignedEmployee).toMatchObject({ id: luis.id });
  });
});
