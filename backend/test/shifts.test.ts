import { beforeEach, describe, expect, it } from 'vitest';
import { bearer, createAdmin, createEmployee, createMachine, createOrder, useTestApp } from './helpers.js';

const ctx = useTestApp();
let adminToken: string;
let adminId: number;
let employeeId: number;
let employeeToken: string;
let orderId: number;

// Turno de mañana del 01/01/2026 en Madrid (invierno, UTC+1): 05:00–13:00 UTC
const MORNING = '/api/shifts/2026-01-01/MORNING';
const utc = (hhmm: string) => new Date(`2026-01-01T${hhmm}:00Z`);

function addWorkLog(start: string, end: string | null, producedQty = 0) {
  return ctx.app.db.workLog.create({
    data: {
      employeeId,
      orderId,
      startedAt: utc(start),
      endedAt: end ? utc(end) : null,
      producedQty,
      stopReason: end ? 'END_OF_SHIFT' : null,
    },
  });
}

const get = (url: string, token = adminToken) =>
  ctx.app.inject({ method: 'GET', url, headers: bearer(token) });

const close = (url: string, force?: boolean) =>
  ctx.app.inject({
    method: 'POST',
    url: `${url}/close`,
    headers: bearer(adminToken),
    payload: force === undefined ? {} : { force },
  });

beforeEach(async () => {
  ({ token: adminToken, user: { id: adminId } } = await createAdmin(ctx.app));
  ({ employee: { id: employeeId }, token: employeeToken } = await createEmployee(ctx.app));
  const machine = await createMachine(ctx.app);
  ({ id: orderId } = await createOrder(ctx.app, { machineId: machine.id, assignedEmployeeId: employeeId }));
});

describe('GET /api/shifts', () => {
  it('lista los tres turnos de cada día con su horario en UTC', async () => {
    const res = await get('/api/shifts?from=2026-03-28&to=2026-03-29');
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.timeZone).toBe('Europe/Madrid');
    expect(body.shifts).toHaveLength(6);
    // Noche del cambio a horario de verano: 22:00 CET → 06:00 CEST
    expect(body.shifts[2]).toMatchObject({
      date: '2026-03-28',
      type: 'NIGHT',
      startsAt: '2026-03-28T21:00:00.000Z',
      endsAt: '2026-03-29T04:00:00.000Z',
      status: 'ENDED',
      closedAt: null,
    });
  });

  it('sin rango, el día del turno actual (que incluye el actual)', async () => {
    const body = (await get('/api/shifts')).json();
    expect(body.from).toBe(body.current.date);
    expect(body.shifts).toHaveLength(3);
    expect(body.shifts.find((s: { type: string }) => s.type === body.current.type).status).toBe('ACTIVE');
  });

  it.each([
    ['solo from', 'from=2026-01-01'],
    ['from posterior a to', 'from=2026-01-02&to=2026-01-01'],
    ['fecha inexistente', 'from=2026-02-30&to=2026-03-01'],
    ['más de 31 días', 'from=2026-01-01&to=2026-02-01'],
    ['formato incorrecto', 'from=1/1/2026&to=2026-01-02'],
  ])('400 con %s', async (_, query) => {
    expect((await get(`/api/shifts?${query}`)).statusCode).toBe(400);
  });

  it('solo para ADMIN', async () => {
    expect((await get('/api/shifts?from=2026-01-01&to=2026-01-01', employeeToken)).statusCode).toBe(403);
  });
});

describe('GET /api/shifts/:date/:type', () => {
  it('recorta horas al turno y cuenta las unidades de lo cerrado dentro', async () => {
    await addWorkLog('05:00', '07:00', 100);
    // Cruza el cambio de turno: 1 h en la mañana; sus unidades se declaran en la tarde
    await addWorkLog('12:00', '14:00', 40);
    // Antes del turno (noche anterior): no cuenta
    await addWorkLog('03:00', '04:00', 10);

    const res = await get(MORNING);
    expect(res.statusCode).toBe(200);
    const { shift, stats, oee, openWorkLogs } = res.json();
    expect(shift).toMatchObject({ startsAt: '2026-01-01T05:00:00.000Z', status: 'ENDED' });
    expect(stats.employees).toEqual([expect.objectContaining({ hours: 3, units: 100 })]);
    expect(oee.total.runHours).toBe(3);
    expect(openWorkLogs).toEqual([]);
  });

  it('400 si el turno aún no ha empezado', async () => {
    expect((await get('/api/shifts/2099-01-01/MORNING')).statusCode).toBe(400);
  });

  it('400 con un tipo de turno que no existe', async () => {
    expect((await get('/api/shifts/2026-01-01/EVENING')).statusCode).toBe(400);
  });
});

describe('POST /api/shifts/:date/:type/close', () => {
  it('sin WorkLog abiertos cierra y guarda quién lo cerró', async () => {
    const res = await close(MORNING);
    expect(res.statusCode).toBe(200);
    expect(res.json().shift).toMatchObject({ status: 'CLOSED', closedBy: { id: adminId } });

    const list = await get('/api/shifts?from=2026-01-01&to=2026-01-01');
    expect(list.json().shifts[0]).toMatchObject({ type: 'MORNING', status: 'CLOSED' });
  });

  it('con WorkLog abiertos avisa (409) y no cierra', async () => {
    const log = await addWorkLog('10:00', null);
    const res = await close(MORNING);
    expect(res.statusCode).toBe(409);
    expect(res.json().openWorkLogs).toEqual([
      expect.objectContaining({ id: log.id, employee: expect.objectContaining({ id: employeeId }) }),
    ]);
    expect((await get(MORNING)).json().shift.status).toBe('ENDED');
  });

  it('con force cierra igualmente, devuelve los abiertos y no los toca', async () => {
    const log = await addWorkLog('10:00', null);
    const res = await close(MORNING, true);
    expect(res.statusCode).toBe(200);
    expect(res.json().openWorkLogs).toHaveLength(1);
    const after = await ctx.app.db.workLog.findUniqueOrThrow({ where: { id: log.id } });
    expect(after.endedAt).toBeNull();
  });

  it('un WorkLog abierto después del fin del turno no cuenta', async () => {
    await addWorkLog('13:30', null);
    expect((await close(MORNING)).statusCode).toBe(200);
  });

  it('409 si ya estaba cerrado', async () => {
    await close(MORNING);
    const res = await close(MORNING);
    expect(res.statusCode).toBe(409);
    expect(res.json().message).toBe('El turno ya está cerrado');
  });

  it('400 si el turno aún no ha empezado', async () => {
    expect((await close('/api/shifts/2099-01-01/NIGHT')).statusCode).toBe(400);
  });
});
