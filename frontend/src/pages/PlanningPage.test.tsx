import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/apiError';
import { apiFetch } from '../api/client';
import { setPlanningDay } from '../store/uiSlice';
import { renderWithProviders } from '../test/render';
import type { Planning, PlanningOrder } from '../types/planning';
import { PlanningPage } from './PlanningPage';

vi.mock('../api/client', () => ({ apiFetch: vi.fn() }));
const apiFetchMock = vi.mocked(apiFetch);

function order(id: number, data: Partial<PlanningOrder> = {}): PlanningOrder {
  return {
    id,
    code: `OF-${id}`,
    product: 'Pieza',
    status: 'PENDING',
    quantity: 10,
    producedQty: 0,
    cycleTimeSec: 60,
    priority: null,
    plannedStart: null,
    startedAt: null,
    assignedEmployee: null,
    estimatedStart: null,
    estimatedEnd: null,
    overlapsWith: [],
    ...data,
  };
}

// Planta en Tokio: el 10/01 va de 09/01 15:00Z a 10/01 15:00Z
const PLANNING: Planning = {
  timeZone: 'Asia/Tokyo',
  machines: [
    {
      id: 1,
      code: 'MAQ-01',
      name: 'Torno',
      status: 'ACTIVE',
      orders: [
        order(1, { estimatedStart: '2026-01-09T16:00:00Z', estimatedEnd: '2026-01-09T20:00:00Z', overlapsWith: [2] }),
        order(2, { estimatedStart: '2026-01-09T18:00:00Z', estimatedEnd: '2026-01-09T22:00:00Z', overlapsWith: [1] }),
        order(3, { cycleTimeSec: null }),
      ],
    },
  ],
  withoutMachine: [],
};

// Códigos en el orden en que aparecen en la cola
const queueCodes = () =>
  screen.getAllByRole('button', { name: /^Subir / }).map((b) => b.getAttribute('aria-label')!.replace('Subir ', ''));

async function renderPage() {
  const result = renderWithProviders(
    <MemoryRouter>
      <PlanningPage />
    </MemoryRouter>,
  );
  act(() => {
    result.store.dispatch(setPlanningDay('2026-01-10'));
  });
  await screen.findByText('Colas por máquina');
  return result;
}

describe('PlanningPage', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('pinta las barras y avisa de los solapes', async () => {
    apiFetchMock.mockResolvedValue(PLANNING);
    await renderPage();

    expect(screen.getByText('Hay 1 solape')).toBeInTheDocument();
    expect(screen.getByText('MAQ-01: OF-1 y OF-2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'OF-1 (solapada)' })).toBeInTheDocument();
    // OF-3 no tiene ciclo: solo está en la cola (su enlace), no hay barra en el Gantt
    expect(screen.getAllByRole('button', { name: /^OF-2/ })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /^OF-3/ })).toHaveLength(1);
    expect(screen.getByText(/Sin ciclo ideal/)).toBeInTheDocument();
  });

  it('reordenar cambia la cola al momento, antes de que responda el servidor', async () => {
    let resolvePut!: () => void;
    apiFetchMock.mockImplementation((_path: string, options?: RequestInit) => {
      if (options?.method === 'PUT') return new Promise<void>((resolve) => (resolvePut = resolve)) as Promise<never>;
      return Promise.resolve(PLANNING);
    });
    await renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Bajar OF-1' }));

    expect(queueCodes()).toEqual(['OF-2', 'OF-1', 'OF-3']);
    expect(apiFetchMock).toHaveBeenCalledWith('/planning/machines/1/sequence', {
      method: 'PUT',
      body: JSON.stringify({ orderIds: [2, 1, 3] }),
    });

    resolvePut();
    // onSettled vuelve a pedir la planificación
    await waitFor(() => expect(apiFetchMock.mock.calls.filter(([path]) => path === '/planning')).toHaveLength(2));
  });

  it('si el servidor rechaza el cambio, la cola vuelve a como estaba', async () => {
    apiFetchMock.mockImplementation((_path: string, options?: RequestInit) =>
      options?.method === 'PUT'
        ? Promise.reject(new ApiError(409, 'La cola de la máquina ha cambiado: recarga la planificación', null))
        : Promise.resolve(PLANNING),
    );
    await renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Bajar OF-1' }));

    await waitFor(() => expect(queueCodes()).toEqual(['OF-1', 'OF-2', 'OF-3']));
  });
});
