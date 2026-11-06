import { describe, expect, it } from 'vitest';
import type { LiveEvent } from '../src/plugins/events.js';
import {
  bearer,
  createAdmin,
  createEmployee,
  createMachine,
  createOrder,
  useTestApp,
  type TestApp,
} from './helpers.js';

const ctx = useTestApp();

type WebSocket = Awaited<ReturnType<TestApp['injectWS']>>;

// Promesa con el siguiente mensaje del socket, ya parseado
function nextEvent(ws: WebSocket) {
  return new Promise<LiveEvent>((resolve) => {
    ws.once('message', (data) => resolve(JSON.parse(data.toString())));
  });
}

describe('GET /api/realtime (WebSocket)', () => {
  it('rechaza el upgrade sin token o con rol EMPLOYEE', async () => {
    await expect(ctx.app.injectWS('/api/realtime')).rejects.toThrow('401');
    const { token } = await createEmployee(ctx.app);
    await expect(ctx.app.injectWS(`/api/realtime?token=${token}`)).rejects.toThrow('403');
  });

  it('el token en ?token= solo vale para el WebSocket', async () => {
    const { token } = await createAdmin(ctx.app);
    const res = await ctx.app.inject({ method: 'GET', url: `/api/machines?token=${token}` });
    expect(res.statusCode).toBe(401);
  });

  it('avisa al iniciar y al finalizar un trabajo en planta', async () => {
    const admin = await createAdmin(ctx.app);
    const { employee, token } = await createEmployee(ctx.app);
    const machine = await createMachine(ctx.app);
    const order = await createOrder(ctx.app, { machineId: machine.id, assignedEmployeeId: employee.id });

    const ws = await ctx.app.injectWS(`/api/realtime?token=${admin.token}`);
    try {
      let event = nextEvent(ws);
      const start = await ctx.app.inject({
        method: 'POST',
        url: `/api/shopfloor/orders/${order.id}/start`,
        headers: bearer(token),
      });
      expect(start.statusCode).toBe(201);
      expect(await event).toEqual({ type: 'worklog.started', orderId: order.id });

      event = nextEvent(ws);
      const stop = await ctx.app.inject({
        method: 'POST',
        url: `/api/shopfloor/worklogs/${start.json().id}/stop`,
        headers: bearer(token),
        payload: { producedQty: 10, stopReason: 'MACHINE_ISSUE', note: 'Atasco' },
      });
      expect(stop.statusCode).toBe(200);
      expect(await event).toEqual({ type: 'worklog.closed', orderId: order.id, stopReason: 'MACHINE_ISSUE' });
    } finally {
      ws.terminate();
    }
  });

  it('no avisa si la operación falla', async () => {
    const admin = await createAdmin(ctx.app);
    const { employee, token } = await createEmployee(ctx.app);
    // Orden sin asignar: el inicio da 403 y la transacción se deshace
    const notMine = await createOrder(ctx.app, { code: 'OF-T2' });
    const mine = await createOrder(ctx.app, { assignedEmployeeId: employee.id });
    const start = (orderId: number) =>
      ctx.app.inject({ method: 'POST', url: `/api/shopfloor/orders/${orderId}/start`, headers: bearer(token) });

    const ws = await ctx.app.injectWS(`/api/realtime?token=${admin.token}`);
    try {
      const event = nextEvent(ws);
      expect((await start(notMine.id)).statusCode).toBe(403);
      expect((await start(mine.id)).statusCode).toBe(201);
      // El primer mensaje es el del inicio bueno: el fallido no publicó nada
      expect(await event).toEqual({ type: 'worklog.started', orderId: mine.id });
    } finally {
      ws.terminate();
    }
  });
});
