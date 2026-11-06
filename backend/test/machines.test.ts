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
let token: string;

beforeEach(async () => {
  ({ token } = await createAdmin(ctx.app));
});

function patchMachine(id: number, payload: Record<string, unknown>) {
  return ctx.app.inject({
    method: 'PATCH',
    url: `/api/machines/${id}`,
    headers: bearer(token),
    payload,
  });
}

function maintenancesOf(machineId: number) {
  return ctx.app.db.machineMaintenance.findMany({ where: { machineId }, orderBy: { id: 'asc' } });
}

describe('PATCH /api/machines/:id (historial de mantenimiento)', () => {
  it('pasar a MAINTENANCE abre un periodo sin WorkLog y reactivarla lo cierra', async () => {
    const machine = await createMachine(ctx.app);

    expect((await patchMachine(machine.id, { status: 'MAINTENANCE' })).statusCode).toBe(200);
    const [opened] = await maintenancesOf(machine.id);
    expect(opened).toMatchObject({ workLogId: null, endedAt: null });

    expect((await patchMachine(machine.id, { status: 'ACTIVE' })).statusCode).toBe(200);
    const [closed] = await maintenancesOf(machine.id);
    expect(closed.endedAt).not.toBeNull();
  });

  it('repetir el mismo estado o cambiar solo el nombre no toca el historial', async () => {
    const machine = await createMachine(ctx.app);
    await patchMachine(machine.id, { status: 'MAINTENANCE' });
    await patchMachine(machine.id, { status: 'MAINTENANCE', name: 'Otro nombre' });

    const maintenances = await maintenancesOf(machine.id);
    expect(maintenances).toHaveLength(1);
    expect(maintenances[0].endedAt).toBeNull();
  });

  it('con una máquina que no existe da 404', async () => {
    expect((await patchMachine(999_999, { status: 'ACTIVE' })).statusCode).toBe(404);
  });
});

describe('GET /api/machines/:id/detail', () => {
  // 01/10/2026 00:00 en Madrid (verano, UTC+2)
  const T0 = new Date('2026-09-30T22:00:00Z');
  const at = (h: number) => new Date(T0.getTime() + h * 3_600_000);
  const range = 'from=2026-10-01&to=2026-10-01';

  function getDetail(id: number) {
    return ctx.app.inject({
      method: 'GET',
      url: `/api/machines/${id}/detail?${range}`,
      headers: bearer(token),
    });
  }

  it('calcula horas trabajadas, de mantenimiento y MTBF dentro del rango', async () => {
    const { employee } = await createEmployee(ctx.app);
    const machine = await createMachine(ctx.app);
    const other = await createMachine(ctx.app, { code: 'MAQ-T2' });
    const order = await createOrder(ctx.app, { machineId: machine.id });
    const otherOrder = await createOrder(ctx.app, { code: 'OF-T2', machineId: other.id });

    const issue = await ctx.app.db.workLog.create({
      data: {
        employeeId: employee.id, orderId: order.id, startedAt: at(-1), endedAt: at(4),
        producedQty: 10, stopReason: 'MACHINE_ISSUE', note: 'Atasco',
      },
    });
    await ctx.app.db.workLog.createMany({
      data: [
        { employeeId: employee.id, orderId: order.id, startedAt: at(5), endedAt: at(9), producedQty: 10, stopReason: 'END_OF_SHIFT' },
        // Otra máquina: no cuenta
        { employeeId: employee.id, orderId: otherOrder.id, startedAt: at(1), endedAt: at(2), stopReason: 'MACHINE_ISSUE', note: 'Otra' },
      ],
    });
    await ctx.app.db.machineMaintenance.createMany({
      data: [
        { machineId: machine.id, workLogId: issue.id, startedAt: at(4), endedAt: at(5) },
        // Abierto: cuenta hasta el final del rango
        { machineId: machine.id, startedAt: at(9.5) },
        { machineId: other.id, startedAt: at(2), endedAt: at(3) },
      ],
    });

    const res = await getDetail(machine.id);

    expect(res.statusCode).toBe(200);
    const body = res.json();
    // Trabajadas: 4 h (recortado desde -1 h) + 4 h; mantenimiento: 1 h + 14,5 h (abierto, hasta las 24 h)
    expect(body.metrics).toEqual({ workedHours: 8, maintenanceHours: 15.5, failures: 1, mtbfHours: 8 });
    expect(body.orders).toEqual([expect.objectContaining({ id: order.id })]);
    expect(body.incidents).toEqual([
      expect.objectContaining({
        id: issue.id,
        note: 'Atasco',
        maintenance: { startedAt: at(4).toISOString(), endedAt: at(5).toISOString() },
      }),
    ]);
    expect(body.maintenances).toEqual([
      expect.objectContaining({ endedAt: null, orderCode: null }),
      expect.objectContaining({ orderCode: order.code, note: 'Atasco' }),
    ]);
  });

  it('sin incidencias el MTBF es null', async () => {
    const machine = await createMachine(ctx.app);
    const res = await getDetail(machine.id);
    expect(res.json().metrics).toEqual({ workedHours: 0, maintenanceHours: 0, failures: 0, mtbfHours: null });
  });

  it('con una máquina que no existe da 404', async () => {
    expect((await getDetail(999_999)).statusCode).toBe(404);
  });
});
