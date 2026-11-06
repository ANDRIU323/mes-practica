import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import type { ShopfloorOrder } from '../../types/shopfloor';
import { StopWorkModal } from './StopWorkModal';

const order: ShopfloorOrder = {
  id: 1,
  code: 'OF-1',
  product: 'Eje 20mm',
  quantity: 100,
  producedQty: 40,
  status: 'IN_PROGRESS',
  plannedStart: null,
  machine: { code: 'MAQ-01', name: 'Torno CNC' },
  openWorkLog: { id: 7, startedAt: '2026-11-02T08:00:00.000Z' },
};

function renderModal() {
  const onSubmit = vi.fn();
  renderWithProviders(
    <StopWorkModal order={order} opened onClose={() => {}} onSubmit={onSubmit} />,
  );
  return { onSubmit, user: userEvent.setup() };
}

describe('StopWorkModal', () => {
  it('con incidencia y sin nota no envía y pide describirla', async () => {
    const { onSubmit, user } = renderModal();

    await user.click(screen.getByRole('button', { name: 'Incidencia' }));
    await user.type(screen.getByLabelText(/Unidades producidas/), '5');
    await user.click(screen.getByRole('button', { name: 'Finalizar' }));

    expect(await screen.findByText('Describe la incidencia')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('con incidencia y nota envía la nota', async () => {
    const { onSubmit, user } = renderModal();

    await user.click(screen.getByRole('button', { name: 'Incidencia' }));
    await user.type(screen.getByLabelText(/Unidades producidas/), '5');
    await user.type(screen.getByLabelText(/Nota/), '  Atasco en la matriz ');
    await user.click(screen.getByRole('button', { name: 'Finalizar' }));

    // El segundo argumento es el evento del formulario
    expect(onSubmit).toHaveBeenCalledWith(
      { stopReason: 'MACHINE_ISSUE', producedQty: 5, note: 'Atasco en la matriz' },
      expect.anything(),
    );
  });

  it('con otro motivo la nota no es obligatoria', async () => {
    const { onSubmit, user } = renderModal();

    await user.click(screen.getByRole('button', { name: 'Descanso' }));
    await user.type(screen.getByLabelText(/Unidades producidas/), '12');
    await user.click(screen.getByRole('button', { name: 'Finalizar' }));

    expect(onSubmit).toHaveBeenCalledWith(
      { stopReason: 'BREAK', producedQty: 12, note: undefined },
      expect.anything(),
    );
    expect(screen.queryByText('Describe la incidencia')).not.toBeInTheDocument();
  });
});
