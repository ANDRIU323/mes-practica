import { screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/apiError';
import { apiFetch } from '../api/client';
import { renderWithProviders } from '../test/render';
import type { MachineDetail } from '../types/machine';
import { MachineDetailPage } from './MachineDetailPage';

vi.mock('../api/client', () => ({ apiFetch: vi.fn() }));
const apiFetchMock = vi.mocked(apiFetch);

const ANA = { id: 1, code: 'EMP-01', name: 'Ana López' };

const DETAIL: MachineDetail = {
  machine: { id: 3, code: 'MAQ-01', name: 'Torno CNC', status: 'MAINTENANCE', createdAt: '2026-01-01T00:00:00.000Z' },
  from: '2026-01-01T00:00:00.000Z',
  to: '2026-01-08T00:00:00.000Z',
  metrics: { workedHours: 12.5, maintenanceHours: 2, failures: 2, mtbfHours: 6.25 },
  orders: [
    {
      id: 10, code: 'OF-1', product: 'Eje 20mm', quantity: 500, producedQty: 230, status: 'IN_PROGRESS',
      plannedStart: null, startedAt: '2026-01-02T08:00:00.000Z', finishedAt: null, assignedEmployee: ANA,
    },
  ],
  incidents: [
    {
      id: 20, endedAt: '2026-01-03T10:00:00.000Z', note: 'Vibración en el cabezal', employee: ANA,
      order: { id: 10, code: 'OF-1' },
      maintenance: { startedAt: '2026-01-03T10:00:00.000Z', endedAt: null },
    },
  ],
  maintenances: [
    { id: 30, startedAt: '2026-01-03T10:00:00.000Z', endedAt: null, orderCode: 'OF-1', note: 'Vibración en el cabezal' },
    { id: 31, startedAt: '2026-01-02T10:00:00.000Z', endedAt: '2026-01-02T11:00:00.000Z', orderCode: null, note: null },
  ],
};

function renderPage() {
  return renderWithProviders(
    <MemoryRouter initialEntries={['/machines/3']}>
      <Routes>
        <Route path="/machines/:id" element={<MachineDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('MachineDetailPage', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('pide el detalle de la máquina de la URL y muestra métricas, incidencias y órdenes', async () => {
    apiFetchMock.mockResolvedValue(DETAIL);
    renderPage();

    expect(await screen.findByText('MAQ-01 · Torno CNC')).toBeInTheDocument();
    expect(apiFetchMock.mock.calls[0][0]).toMatch(/^\/machines\/3\/detail\?from=.+&to=.+/);
    expect(screen.getByText('12 h 30 min')).toBeInTheDocument();
    expect(screen.getByText('6 h 15 min')).toBeInTheDocument();
    expect(screen.getByText('Eje 20mm')).toBeInTheDocument();
    expect(screen.getByText('230 / 500')).toBeInTheDocument();
    expect(screen.getAllByText('Vibración en el cabezal')).toHaveLength(2);
    expect(screen.getByText('Puesta a mano')).toBeInTheDocument();
  });

  it('sin incidencias el MTBF se muestra como «—»', async () => {
    apiFetchMock.mockResolvedValue({
      ...DETAIL,
      metrics: { workedHours: 3, maintenanceHours: 0, failures: 0, mtbfHours: null },
      incidents: [],
    });
    renderPage();

    expect(await screen.findByText('Sin incidencias en el rango.')).toBeInTheDocument();
    const mtbfCard = screen.getByText('Tiempo medio entre averías').parentElement!;
    expect(within(mtbfCard).getByText('—')).toBeInTheDocument();
  });

  it('muestra el error si la máquina no existe', async () => {
    apiFetchMock.mockRejectedValue(new ApiError(404, 'Máquina no encontrada', { message: 'Máquina no encontrada' }));
    renderPage();

    expect(await screen.findByText('Máquina no encontrada')).toBeInTheDocument();
  });
});
