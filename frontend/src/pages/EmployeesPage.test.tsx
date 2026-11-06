import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../api/client';
import { renderWithProviders } from '../test/render';
import type { EmployeeWithTotals } from '../types/employee';
import { EmployeesPage } from './EmployeesPage';

vi.mock('../api/client', () => ({ apiFetch: vi.fn() }));
const apiFetchMock = vi.mocked(apiFetch);

function makeEmployee(data: Partial<EmployeeWithTotals>): EmployeeWithTotals {
  return {
    id: 1,
    code: 'EMP-01',
    name: 'Ana López',
    active: true,
    lockedUntil: null,
    hasPin: true,
    totalHours: 0,
    totalUnits: 0,
    createdAt: '2026-11-01T08:00:00.000Z',
    updatedAt: '2026-11-01T08:00:00.000Z',
    ...data,
  };
}

describe('EmployeesPage – PIN y bloqueo', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('marca los bloqueados y los que no tienen PIN', async () => {
    const inOneHour = new Date(Date.now() + 3_600_000).toISOString();
    apiFetchMock.mockResolvedValue([
      makeEmployee({ id: 1, code: 'EMP-01', lockedUntil: inOneHour }),
      makeEmployee({ id: 2, code: 'EMP-02', hasPin: false }),
      makeEmployee({ id: 3, code: 'EMP-03', lockedUntil: '2026-01-01T00:00:00.000Z' }),
    ]);

    renderWithProviders(<EmployeesPage />);

    const row = async (code: string) => (await screen.findByText(code)).closest('tr')!;
    expect(within(await row('EMP-01')).getByText('Bloqueado')).toBeInTheDocument();
    expect(within(await row('EMP-02')).getByText('Sin PIN')).toBeInTheDocument();
    // Un bloqueo ya pasado no se muestra
    expect(within(await row('EMP-03')).queryByText('Bloqueado')).not.toBeInTheDocument();
  });

  it('guarda el PIN nuevo con PUT /employees/:id/pin', async () => {
    apiFetchMock.mockImplementation((_path, options) =>
      Promise.resolve(options?.method === 'PUT' ? undefined : [makeEmployee({ id: 7, code: 'EMP-07' })]),
    );
    const user = userEvent.setup();

    renderWithProviders(<EmployeesPage />);
    await user.click(await screen.findByRole('button', { name: 'PIN' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getAllByRole('textbox')[0]);
    await user.keyboard('4321');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith('/employees/7/pin', {
        method: 'PUT',
        body: JSON.stringify({ pin: '4321' }),
      }),
    );
  });
});
