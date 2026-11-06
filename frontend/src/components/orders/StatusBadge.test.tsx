import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { ORDER_STATUS_CONFIG, ORDER_STATUSES } from './orderStatus';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  // Un test por estado: si falla uno, el nombre dice cuál
  it.each(ORDER_STATUSES)('%s muestra su texto y su color', (status) => {
    const { label, color } = ORDER_STATUS_CONFIG[status];

    renderWithProviders(<StatusBadge status={status} />);

    const badge = screen.getByText(label).closest('.mantine-Badge-root');
    expect(badge).not.toBeNull();
    // Mantine pinta el color con una variable CSS en el style del Badge
    expect(badge).toHaveStyle({ '--badge-bg': `var(--mantine-color-${color}-light)` });
  });
});
