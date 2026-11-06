import { beforeEach, describe, expect, it } from 'vitest';
import { bearer, createAdmin, createEmployee, createMachine, createOrder, useTestApp } from './helpers.js';

const ctx = useTestApp();
let adminToken: string;
let employeeId: number;

// Horas del 01/01/2026 en Madrid (00:00 = 31/12 23:00 UTC): un día ya pasado, así
// "ahora" no recorta el rango
const at = (hours: number) => new Date(Date.UTC(2025, 11, 31, 23) + hours * 3_600_000);
const DAY = 'from=2026-01-01&to=2026-01-01';

function addWorkLog(
  orderId: number,
  start: number,
  end: number | null,
  data: { producedQty?: number; stopReason?: 'END_OF_SHIFT' | 'BREAK' | 'MACHINE_ISSUE' | 'LINE_CHANGE' } = {},
) {
  return ctx.app.db.workLog.create({
    data: {
      employeeId,
      orderId,
      startedAt: at(start),
      endedAt: end === null ? null : at(end),
      note: data.stopReason === 'MACHINE_ISSUE' ? 'Avería' : null,
      ...data,
    },
  });
}

function get(url: string) {
  return ctx.app.inject({ method: 'GET', url, headers: bearer(adminToken) });
}

beforeEach(async () => {
  ({ token: adminToken } = await createAdmin(ctx.app));
  ({ employee: { id: employeeId } } = await createEmployee(ctx.app));
});

describe('GET /api/dashboard/oee', () => {
  // MAQ-1, ciclo ideal 36 s (100 piezas/h):
  //   08–10 h, 150 piezas, avería → parada no planificada 10–11 h
  //   11–12 h, 50 piezas, fin de turno → parada prevista, no cuenta
  //   Disponibilidad 3/4, Rendimiento (2 h ideales)/(3 h) → OEE 0,5
  // MAQ-2, orden sin ciclo ideal: 13–14 h, descanso → solo Disponibilidad
  beforeEach(async () => {
    const m1 = await createMachine(ctx.app, { code: 'MAQ-1' });
    const m2 = await createMachine(ctx.app, { code: 'MAQ-2' });
    const o1 = await createOrder(ctx.app, { code: 'OF-1', machineId: m1.id, cycleTimeSec: 36 });
    const o2 = await createOrder(ctx.app, { code: 'OF-2', machineId: m2.id });
    // Sin máquina: no cuenta para el OEE
    const o3 = await createOrder(ctx.app, { code: 'OF-3' });

    await addWorkLog(o1.id, 8, 10, { producedQty: 150, stopReason: 'MACHINE_ISSUE' });
    await addWorkLog(o1.id, 11, 12, { producedQty: 50, stopReason: 'END_OF_SHIFT' });
    await addWorkLog(o2.id, 13, 14, { producedQty: 10, stopReason: 'BREAK' });
    await addWorkLog(o3.id, 8, 9, { producedQty: 5, stopReason: 'END_OF_SHIFT' });
  });

  it('calcula Disponibilidad, Rendimiento y OEE por máquina, peor primero', async () => {
    const res = await get(`/api/dashboard/oee?${DAY}`);
    expect(res.statusCode).toBe(200);

    const { machines, total } = res.json();
    expect(machines).toEqual([
      {
        machine: expect.objectContaining({ code: 'MAQ-1' }),
        runHours: 3,
        unplannedStopHours: 1,
        availability: 0.75,
        performance: 0.6667,
        quality: 1,
        oee: 0.5,
      },
      {
        machine: expect.objectContaining({ code: 'MAQ-2' }),
        runHours: 1,
        unplannedStopHours: 0,
        availability: 1,
        performance: null,
        quality: null,
        oee: null,
      },
    ]);
    // El total suma tiempos: Disponibilidad 4/5 y Rendimiento solo con lo que tiene ciclo
    expect(total).toMatchObject({ runHours: 4, availability: 0.8, performance: 0.6667, oee: 0.5333 });
  });

  it('un WorkLog que cae en parte en el rango cuenta la parte proporcional de sus piezas', async () => {
    // De 23 h a 1 h del día siguiente, 150 piezas: en el día cae 1 h (75 piezas × 36 s)
    const m3 = await createMachine(ctx.app, { code: 'MAQ-3' });
    const o4 = await createOrder(ctx.app, { code: 'OF-4', machineId: m3.id, cycleTimeSec: 36 });
    await addWorkLog(o4.id, 23, 25, { producedQty: 150, stopReason: 'END_OF_SHIFT' });

    const res = await get(`/api/dashboard/oee?${DAY}`);
    const maq3 = res.json().machines.find((m: { machine: { code: string } }) => m.machine.code === 'MAQ-3');
    expect(maq3).toMatchObject({ runHours: 1, performance: 0.75 });
  });

  it('los días son de medianoche a medianoche en Madrid (el del cambio de hora dura 23 h)', async () => {
    const res = await get('/api/dashboard/oee?from=2026-03-29&to=2026-03-29');
    expect(res.json()).toMatchObject({ from: '2026-03-28T23:00:00.000Z', to: '2026-03-29T22:00:00.000Z' });
  });

  it.each([
    ['formato incorrecto', 'from=2026-01-01T00:00:00Z&to=2026-01-02'],
    ['from posterior a to', 'from=2026-01-02&to=2026-01-01'],
  ])('rango no válido (%s) da 400', async (_, query) => {
    expect((await get(`/api/dashboard/oee?${query}`)).statusCode).toBe(400);
  });

  it('un WorkLog abierto suma tiempo trabajado pero no Rendimiento', async () => {
    const m3 = await createMachine(ctx.app, { code: 'MAQ-3' });
    const o4 = await createOrder(ctx.app, { code: 'OF-4', machineId: m3.id, cycleTimeSec: 36 });
    const { employee } = await createEmployee(ctx.app, { code: 'EMP-T2' });
    await ctx.app.db.workLog.create({
      data: { employeeId: employee.id, orderId: o4.id, startedAt: at(20) },
    });

    const res = await get(`/api/dashboard/oee?${DAY}`);
    const maq3 = res.json().machines.find((m: { machine: { code: string } }) => m.machine.code === 'MAQ-3');
    expect(maq3).toMatchObject({ runHours: 4, availability: 1, performance: null, oee: null });
  });

  it('sin token de admin da 401', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: `/api/dashboard/oee?${DAY}` });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/dashboard/stats', () => {
  it('sigue calculando los minutos parados por motivo', async () => {
    const machine = await createMachine(ctx.app);
    const order = await createOrder(ctx.app, { machineId: machine.id });
    await addWorkLog(order.id, 8, 10, { producedQty: 10, stopReason: 'MACHINE_ISSUE' });
    await addWorkLog(order.id, 10.5, 12, { producedQty: 10, stopReason: 'END_OF_SHIFT' });

    const res = await get(`/api/dashboard/stats?${DAY}`);
    expect(res.json().stoppedMinutes).toEqual(
      expect.arrayContaining([
        { reason: 'MACHINE_ISSUE', minutes: 30 },
        { reason: 'END_OF_SHIFT', minutes: 12 * 60 },
      ]),
    );
  });
});
