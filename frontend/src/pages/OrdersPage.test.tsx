import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, apiFetchBlob } from '../api/client';
import { renderWithProviders } from '../test/render';
import type { ProductionOrder } from '../types/order';
import { downloadBlob } from '../utils/downloadBlob';
import { OrdersPage } from './OrdersPage';

// Toda la capa api/ pasa por apiFetch: con esto no sale ninguna petición real
vi.mock('../api/client', () => ({ apiFetch: vi.fn(), apiFetchBlob: vi.fn() }));
const apiFetchMock = vi.mocked(apiFetch);
const apiFetchBlobMock = vi.mocked(apiFetchBlob);
// jsdom no tiene URL.createObjectURL
vi.mock('../utils/downloadBlob', () => ({ downloadBlob: vi.fn() }));

function makeOrder(data: Partial<ProductionOrder>): ProductionOrder {
  return {
    id: 1,
    code: 'OF-1',
    product: 'Eje 20mm',
    quantity: 100,
    producedQty: 0,
    cycleTimeSec: null,
    status: 'PENDING',
    machineId: null,
    machine: null,
    assignedEmployeeId: null,
    assignedEmployee: null,
    openWorkLog: null,
    plannedStart: null,
    startedAt: null,
    finishedAt: null,
    createdAt: '2026-11-01T08:00:00.000Z',
    updatedAt: '2026-11-01T08:00:00.000Z',
    ...data,
  };
}

// Responde a /orders con `orders` (o con su promesa) y al resto (empleados del modal) con []
function mockOrders(orders: ProductionOrder[] | Promise<never>) {
  apiFetchMock.mockImplementation((path: string) =>
    path.startsWith('/orders') ? Promise.resolve(orders) : Promise.resolve([]),
  );
}

describe('OrdersPage', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchBlobMock.mockReset();
    vi.mocked(downloadBlob).mockReset();
  });

  it('muestra el indicador de carga mientras llega la respuesta', () => {
    // Una promesa que nunca se resuelve deja la consulta en "pending"
    mockOrders(new Promise<never>(() => {}));

    const { container } = renderWithProviders(<OrdersPage />);

    expect(container.querySelector('.mantine-Loader-root')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('muestra el error de la API', async () => {
    apiFetchMock.mockRejectedValue(new Error('Servidor caído'));

    renderWithProviders(<OrdersPage />);

    expect(await screen.findByText('No se pudieron cargar las órdenes')).toBeInTheDocument();
    expect(screen.getByText('Servidor caído')).toBeInTheDocument();
  });

  it('muestra un mensaje si no hay órdenes', async () => {
    mockOrders([]);

    renderWithProviders(<OrdersPage />);

    expect(await screen.findByText('No hay órdenes de producción.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('muestra una fila por orden en la tabla', async () => {
    mockOrders([
      makeOrder({ id: 1, code: 'OF-1', product: 'Eje 20mm' }),
      makeOrder({ id: 2, code: 'OF-2', product: 'Brida', status: 'IN_PROGRESS' }),
    ]);

    renderWithProviders(<OrdersPage />);

    const table = await screen.findByRole('table');
    expect(table).toHaveTextContent('OF-1');
    expect(table).toHaveTextContent('Brida');
    // Cabecera + 2 órdenes
    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(apiFetchMock).toHaveBeenCalledWith('/orders');
  });

  it('sin órdenes no se puede exportar', async () => {
    mockOrders([]);

    renderWithProviders(<OrdersPage />);

    await screen.findByText('No hay órdenes de producción.');
    expect(screen.getByRole('button', { name: 'Exportar Excel' })).toBeDisabled();
  });

  it('exportar descarga el Excel con el filtro actual', async () => {
    mockOrders([makeOrder({})]);
    const blob = new Blob(['xlsx']);
    apiFetchBlobMock.mockResolvedValue(blob);

    renderWithProviders(<OrdersPage />);
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('button', { name: 'Exportar Excel' }));

    expect(apiFetchBlobMock).toHaveBeenCalledWith('/orders/export');
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledWith('ordenes.xlsx', blob));
  });
});
