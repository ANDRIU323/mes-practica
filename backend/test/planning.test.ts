import { beforeEach, describe, expect, it } from 'vitest';
import { bearer, createAdmin, createMachine, createOrder, useTestApp } from './helpers.js';

const ctx = useTestApp();
let token: string;

beforeEach(async () => {
  ({ token } = await createAdmin(ctx.app));
});

function getPlanning() {
  return ctx.app.inject({ method: 'GET', url: '/api/planning', headers: bearer(token) });
}

function putSequence(machineId: number, orderIds: number[]) {
  return ctx.app.inject({
    method: 'PUT',
    url: `/api/planning/machines/${machineId}/sequence`,
    headers: bearer(token),
    payload: { orderIds },
  });
}

const at = (iso: string) => new Date(iso);

describe('GET /api/planning', () => {
  it('agrupa por máquina en orden de cola, calcula el fin y marca solapes', async () => {
    const machine = await createMachine(ctx.app);
    // 100 piezas × 36 s = 1 h
    const a = await createOrder(ctx.app, {
      code: 'OF-A', machineId: machine.id, cycleTimeSec: 36, plannedStart: at('2030-01-01T08:00:00Z'), priority: 1,
    });
    const b = await createOrder(ctx.app, {
      code: 'OF-B', machineId: machine.id, cycleTimeSec: 36, plannedStart: at('2030-01-01T08:30:00Z'), priority: 0,
    });
    const noCycle = await createOrder(ctx.app, { code: 'OF-C', machineId: machine.id });
    await createOrder(ctx.app, { code: 'OF-D', machineId: machine.id, status: 'DONE' });
    const loose = await createOrder(ctx.app, { code: 'OF-E' });

    const res = await getPlanning();
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.timeZone).toEqual(expect.any(String));

    const [m] = body.machines;
    expect(m.orders.map((o: { id: number }) => o.id)).toEqual([b.id, a.id, noCycle.id]);
    expect(m.orders[1]).toMatchObject({
      estimatedStart: '2030-01-01T08:00:00.000Z',
      estimatedEnd: '2030-01-01T09:00:00.000Z',
      overlapsWith: [b.id],
    });
    expect(m.orders[2]).toMatchObject({ estimatedStart: null, estimatedEnd: null, overlapsWith: [] });
    expect(body.withoutMachine.map((o: { id: number }) => o.id)).toEqual([loose.id]);
  });

  it('exige rol ADMIN', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/planning' });
    expect(res.statusCode).toBe(401);
  });
});

describe('PUT /api/planning/machines/:id/sequence', () => {
  it('guarda la nueva cola como priority 0, 1, 2…', async () => {
    const machine = await createMachine(ctx.app);
    const a = await createOrder(ctx.app, { code: 'OF-A', machineId: machine.id });
    const b = await createOrder(ctx.app, { code: 'OF-B', machineId: machine.id, status: 'IN_PROGRESS' });

    expect((await putSequence(machine.id, [b.id, a.id])).statusCode).toBe(204);

    const orders = await ctx.app.db.productionOrder.findMany({ orderBy: { priority: 'asc' } });
    expect(orders.map((o) => [o.id, o.priority])).toEqual([[b.id, 0], [a.id, 1]]);
  });

  it('409 si la lista no es exactamente la cola actual', async () => {
    const machine = await createMachine(ctx.app);
    const other = await createMachine(ctx.app, { code: 'MAQ-T2' });
    const a = await createOrder(ctx.app, { code: 'OF-A', machineId: machine.id });
    const b = await createOrder(ctx.app, { code: 'OF-B', machineId: machine.id });
    const done = await createOrder(ctx.app, { code: 'OF-C', machineId: machine.id, status: 'DONE' });
    const foreign = await createOrder(ctx.app, { code: 'OF-D', machineId: other.id });

    expect((await putSequence(machine.id, [a.id])).statusCode).toBe(409);
    expect((await putSequence(machine.id, [a.id, b.id, done.id])).statusCode).toBe(409);
    expect((await putSequence(machine.id, [a.id, foreign.id])).statusCode).toBe(409);
  });

  it('400 con ids repetidos y 404 si la máquina no existe', async () => {
    const machine = await createMachine(ctx.app);
    const a = await createOrder(ctx.app, { machineId: machine.id });

    expect((await putSequence(machine.id, [a.id, a.id])).statusCode).toBe(400);
    expect((await putSequence(9999, [])).statusCode).toBe(404);
  });
});

describe('PATCH /api/orders/:id y la cola', () => {
  it('cambiar de máquina quita priority; editar otra cosa lo mantiene', async () => {
    const machine = await createMachine(ctx.app);
    const other = await createMachine(ctx.app, { code: 'MAQ-T2' });
    const order = await createOrder(ctx.app, { machineId: machine.id, priority: 3 });
    const patch = (payload: Record<string, unknown>) =>
      ctx.app.inject({ method: 'PATCH', url: `/api/orders/${order.id}`, headers: bearer(token), payload });

    expect((await patch({ machineId: machine.id, product: 'Otra' })).json().priority).toBe(3);
    expect((await patch({ machineId: other.id })).json().priority).toBeNull();
  });

  it('plannedStart null quita la planificación', async () => {
    const order = await createOrder(ctx.app, { plannedStart: at('2030-01-01T08:00:00Z') });
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/orders/${order.id}`,
      headers: bearer(token),
      payload: { plannedStart: null },
    });
    expect(res.json().plannedStart).toBeNull();
  });
});
