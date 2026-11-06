import { describe, expect, it } from 'vitest';
import { addDays, shiftAt, shiftWindow, shiftsBetween } from '../src/modules/shifts/shifts.time.js';

const HOUR = 3_600_000;
const hours = (w: { startsAt: Date; endsAt: Date }) => (w.endsAt.getTime() - w.startsAt.getTime()) / HOUR;

describe('shiftWindow (Europe/Madrid)', () => {
  it('en invierno la planta va 1 h por delante de UTC', () => {
    const w = shiftWindow('2026-11-05', 'MORNING', 'Europe/Madrid');
    expect(w.startsAt.toISOString()).toBe('2026-11-05T05:00:00.000Z');
    expect(w.endsAt.toISOString()).toBe('2026-11-05T13:00:00.000Z');
  });

  it('en verano, 2 h', () => {
    const w = shiftWindow('2026-07-01', 'AFTERNOON', 'Europe/Madrid');
    expect(w.startsAt.toISOString()).toBe('2026-07-01T12:00:00.000Z');
  });

  it('el turno de noche acaba al día siguiente', () => {
    const w = shiftWindow('2026-11-05', 'NIGHT', 'Europe/Madrid');
    expect(w.startsAt.toISOString()).toBe('2026-11-05T21:00:00.000Z');
    expect(w.endsAt.toISOString()).toBe('2026-11-06T05:00:00.000Z');
  });

  it('la noche del cambio a horario de verano dura 7 h', () => {
    const w = shiftWindow('2026-03-28', 'NIGHT', 'Europe/Madrid');
    expect(w.endsAt.toISOString()).toBe('2026-03-29T04:00:00.000Z');
    expect(hours(w)).toBe(7);
  });

  it('la noche del cambio a horario de invierno dura 9 h', () => {
    const w = shiftWindow('2026-10-24', 'NIGHT', 'Europe/Madrid');
    expect(hours(w)).toBe(9);
  });

  it('en UTC todos duran 8 h', () => {
    expect(hours(shiftWindow('2026-03-28', 'NIGHT', 'UTC'))).toBe(8);
  });
});

describe('shiftAt', () => {
  it('a las 03:00 locales sigue el turno de noche del día anterior', () => {
    // 02:00 UTC = 03:00 en Madrid (invierno)
    expect(shiftAt(new Date('2026-11-05T02:00:00Z'), 'Europe/Madrid')).toEqual({
      date: '2026-11-04',
      type: 'NIGHT',
    });
  });

  it('el cambio de turno va por la hora local, no la UTC', () => {
    // 13:30 UTC = 14:30 en Madrid: ya es la tarde
    expect(shiftAt(new Date('2026-11-05T13:30:00Z'), 'Europe/Madrid').type).toBe('AFTERNOON');
  });

  it('el día del 1 de enero pasa al 31 de diciembre', () => {
    expect(shiftAt(new Date('2027-01-01T01:00:00Z'), 'Europe/Madrid').date).toBe('2026-12-31');
  });
});

describe('shiftsBetween', () => {
  it('tres turnos por día, encadenados sin huecos', () => {
    const shifts = shiftsBetween('2026-10-24', '2026-10-25', 'Europe/Madrid');
    expect(shifts).toHaveLength(6);
    for (let i = 1; i < shifts.length; i++) {
      expect(shifts[i].startsAt).toEqual(shifts[i - 1].endsAt);
    }
  });

  it('addDays cruza meses y años bisiestos', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});
