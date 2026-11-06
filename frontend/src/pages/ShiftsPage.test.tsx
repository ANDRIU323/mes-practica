import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/apiError';
import { apiFetch } from '../api/client';
import { renderWithProviders } from '../test/render';
import type { OpenWorkLog, Shift, ShiftList, ShiftReport } from '../types/shift';
import { ShiftsPage } from './ShiftsPage';

vi.mock('../api/client', () => ({ apiFetch: vi.fn() }));
const apiFetchMock = vi.mocked(apiFetch);

// Planta en Tokio (UTC+9, sin cambio de hora): las horas no dependen de la zona del navegador
const TIME_ZONE = 'Asia/Tokyo';

function makeShift(type: Shift['type'], startsAt: string, endsAt: string, status: Shift['status']): Shift {
  return { date: '2026-01-01', type, startsAt, endsAt, status, closedAt: null, closedBy: null };
}

const LIST: ShiftList = {
  timeZone: TIME_ZONE,
  from: '2026-01-01',
  to: '2026-01-01',
  current: { date: '2026-01-01', type: 'MORNING' },
  shifts: [
    makeShift('MORNING', '2025-12-31T21:00:00.000Z', '2026-01-01T05:00:00.000Z', 'ENDED'),
    makeShift('AFTERNOON', '2026-01-01T05:00:00.000Z', '2026-01-01T13:00:00.000Z', 'ACTIVE'),
    makeShift('NIGHT', '2026-01-01T13:00:00.000Z', '2026-01-01T21:00:00.000Z', 'UPCOMING'),
  ],
};

const OPEN_LOG: OpenWorkLog = {
  id: 7,
  startedAt: '2025-12-31T23:00:00.000Z',
  employee: { id: 1, code: 'EMP-01', name: 'Ana Pérez' },
  order: { id: 1, code: 'OF-1' },
  machine: null,
};

const REPORT: ShiftReport = {
  shift: LIST.shifts[0],
  openWorkLogs: [OPEN_LOG],
  stats: { employees: [], machines: [], stoppedMinutes: [] },
  oee: {
    total: { runHours: 0, unplannedStopHours: 0, availability: null, performance: null, quality: null, oee: null },
    machines: [],
  },
};

const conflict = () =>
  new ApiError(409, 'Quedan 1 registros de trabajo abiertos', { openWorkLogs: [OPEN_LOG] });

describe('ShiftsPage', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation((path: string, options?: RequestInit) => {
      if (path === '/shifts') return Promise.resolve(LIST);
      if (path === '/shifts/2026-01-01/MORNING') return Promise.resolve(REPORT);
      if (path.endsWith('/close')) {
        const { force } = JSON.parse(options!.body as string);
        return force
          ? Promise.resolve({ shift: { ...LIST.shifts[0], status: 'CLOSED' }, openWorkLogs: [OPEN_LOG] })
          : Promise.reject(conflict());
      }
      return Promise.reject(new Error(`Ruta inesperada ${path}`));
    });
  });

  it('pinta las horas en la zona de la planta y abre el turno actual', async () => {
    renderWithProviders(<ShiftsPage />);
    expect(await screen.findByText('Mañana 06:00–14:00')).toBeInTheDocument();
    expect(screen.getByText('Noche 22:00–06:00')).toBeInTheDocument();
    expect(screen.getByText('Sin cerrar')).toBeInTheDocument();
    // Aviso del informe con el WorkLog abierto
    expect(await screen.findByText('Ana Pérez')).toBeInTheDocument();
  });

  it('al cerrar con WorkLog abiertos avisa y permite cerrar igualmente', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ShiftsPage />);

    await user.click(await screen.findByRole('button', { name: 'Cerrar turno' }));
    expect(await screen.findByText('Quedan registros abiertos')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cerrar igualmente' }));
    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith('/shifts/2026-01-01/MORNING/close', {
        method: 'POST',
        body: JSON.stringify({ force: true }),
      }),
    );
    await waitFor(() => expect(screen.queryByText('Quedan registros abiertos')).not.toBeInTheDocument());
  });

  it('un turno que no ha empezado no pide informe ni deja cerrar', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ShiftsPage />);

    await user.click(await screen.findByText('Noche 22:00–06:00'));
    expect(await screen.findByText('El turno aún no ha empezado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cerrar turno' })).not.toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalledWith('/shifts/2026-01-01/NIGHT');
  });
});
