import { describe, expect, it } from 'vitest';
import {
  bearer,
  createEmployee,
  createMachine,
  createOrder,
  useTestApp,
  type TestApp,
} from './helpers.js';

const ctx = useTestApp();

function startWork(app: TestApp, token: string, orderId: number) {
  return app.inject({
    method: 'POST',
    url: `/api/shopfloor/orders/${orderId}/start`,
    headers: bearer(token),
  });
}

function stopWork(
  app: TestApp,
  token: string,
  workLogId: number,
  payload: { producedQty: number; stopReason: string; note?: string },
) {
  return app.inject({
    method: 'POST',
    url: `/api/shopfloor/worklogs/${workLogId}/stop`,
    headers: bearer(token),
    payload,
  });
}

// Inicia y finaliza un tramo; devuelve la respuesta del stop
async function workSession(
  app: TestApp,
  token: string,
  orderId: number,
  payload: Parameters<typeof stopWork>[3],
) {
  const start = await startWork(app, token, orderId);
  expect(start.statusCode).toBe(201);
  return stopWork(app, token, start.json().id, payload);
}

const getOrder = (id: number) => ctx.app.db.productionOrder.findUniqueOrThrow({ where: { id } });

describe('Iniciar trabajo', () => {
  it('abre un WorkLog y la orden PENDING pasa a IN_PROGRESS', async () => {
    const { employee, token } = await createEmployee(ctx.app);
    const order = await createOrder(ctx.app, { assignedEmployeeId: employee.id });

    const res = await startWork(ctx.app, token, order.id);

    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ orderId: order.id, startedAt: expect.any(String) });
    const workLog = await ctx.app.db.workLog.findUniqueOrThrow({ where: { id: res.json().id } });
    expect(workLog.endedAt).toBeNull();
    expect((await getOrder(order.id)).status).toBe('IN_PROGRESS');
  });

  it('iniciar dos veces da 400 y solo queda un WorkLog abierto', async () => {
    const { employee, token } = await createEmployee(ctx.app);
    const order = await createOrder(ctx.app, { assignedEmployeeId: employee.id });

    await startWork(ctx.app, token, order.id);
    const res = await startWork(ctx.app, token, order.id);

    expect(res.statusCode).toBe(400);
    expect(res.json().message).toMatch(/Ya estás trabajando/);
    expect(await ctx.app.db.workLog.count({ where: { endedAt: null } })).toBe(1);
  });

  it('en una orden de otro empleado da 403', async () => {
    const { token } = await createEmployee(ctx.app, { code: 'EMP-A' });
    const { employee: other } = await createEmployee(ctx.app, { code: 'EMP-B' });
    const order = await createOrder(ctx.app, { assignedEmployeeId: other.id });

    const res = await startWork(ctx.app, token, order.id);

    expect(res.statusCode).toBe(403);
  });
});

describe('Finalizar trabajo', () => {
  it('suma las unidades de cada tramo en la orden', async () => {
    const { employee, token } = await createEmployee(ctx.app);
    const order = await createOrder(ctx.app, { assignedEmployeeId: employee.id, quantity: 100 });

    const first = await workSession(ctx.app, token, order.id, { producedQty: 30, stopReason: 'BREAK' });
    expect(first.statusCode).toBe(200);
    const second = await workSession(ctx.app, token, order.id, {
      producedQty: 20,
      stopReason: 'END_OF_SHIFT',
    });

    expect(second.json().order).toMatchObject({ producedQty: 50, status: 'IN_PROGRESS' });
    expect((await getOrder(order.id)).producedQty).toBe(50);
  });

  it('al llegar a la cantidad pedida la orden pasa a DONE', async () => {
    const { employee, token } = await createEmployee(ctx.app);
    const order = await createOrder(ctx.app, { assignedEmployeeId: employee.id, quantity: 50 });

    await workSession(ctx.app, token, order.id, { producedQty: 20, stopReason: 'BREAK' });
    const res = await workSession(ctx.app, token, order.id, {
      producedQty: 30,
      stopReason: 'END_OF_SHIFT',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().order).toMatchObject({ producedQty: 50, status: 'DONE' });
    expect((await getOrder(order.id)).finishedAt).not.toBeNull();
  });

  it('una incidencia pone la máquina de la orden en MAINTENANCE', async () => {
    const { employee, token } = await createEmployee(ctx.app);
    const machine = await createMachine(ctx.app);
    const order = await createOrder(ctx.app, {
      assignedEmployeeId: employee.id,
      machineId: machine.id,
    });

    const res = await workSession(ctx.app, token, order.id, {
      producedQty: 5,
      stopReason: 'MACHINE_ISSUE',
      note: 'Atasco en la matriz',
    });

    expect(res.statusCode).toBe(200);
    const saved = await ctx.app.db.machine.findUniqueOrThrow({ where: { id: machine.id } });
    expect(saved.status).toBe('MAINTENANCE');
    const maintenances = await ctx.app.db.machineMaintenance.findMany({ where: { machineId: machine.id } });
    expect(maintenances).toEqual([
      expect.objectContaining({
        workLogId: res.json().workLog.id,
        startedAt: new Date(res.json().workLog.endedAt),
        endedAt: null,
      }),
    ]);
  });

  it('una incidencia con la máquina ya en mantenimiento no abre otro periodo', async () => {
    const { employee, token } = await createEmployee(ctx.app);
    const machine = await createMachine(ctx.app);
    const order = await createOrder(ctx.app, {
      assignedEmployeeId: employee.id,
      machineId: machine.id,
    });
    const issue = { producedQty: 1, stopReason: 'MACHINE_ISSUE', note: 'Fuga de aceite' };

    await workSession(ctx.app, token, order.id, issue);
    await workSession(ctx.app, token, order.id, issue);

    expect(await ctx.app.db.machineMaintenance.count({ where: { machineId: machine.id } })).toBe(1);
  });

  it('una incidencia sin nota da 400 y no toca la máquina ni cierra el trabajo', async () => {
    const { employee, token } = await createEmployee(ctx.app);
    const machine = await createMachine(ctx.app);
    const order = await createOrder(ctx.app, {
      assignedEmployeeId: employee.id,
      machineId: machine.id,
    });
    const start = await startWork(ctx.app, token, order.id);

    const res = await stopWork(ctx.app, token, start.json().id, {
      producedQty: 5,
      stopReason: 'MACHINE_ISSUE',
    });

    expect(res.statusCode).toBe(400);
    const saved = await ctx.app.db.machine.findUniqueOrThrow({ where: { id: machine.id } });
    expect(saved.status).toBe('ACTIVE');
    expect(await ctx.app.db.workLog.count({ where: { endedAt: null } })).toBe(1);
  });
});
