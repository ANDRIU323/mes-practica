import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../test/render';
import type { DashboardOee, OeeResult } from '../../types/dashboard';
import { OeeCard, oeeColor } from './OeeCard';

function result(data: Partial<OeeResult>): OeeResult {
  return {
    runHours: 3,
    unplannedStopHours: 1,
    availability: 0.75,
    performance: 0.6667,
    quality: 1,
    oee: 0.5,
    ...data,
  };
}

const DATA: DashboardOee = {
  from: '2026-11-01T00:00:00.000Z',
  to: '2026-11-02T00:00:00.000Z',
  total: result({ availability: 0.8, oee: 0.5333 }),
  machines: [
    { machine: { id: 1, code: 'MAQ-01', name: 'CNC' }, ...result({}) },
    {
      machine: { id: 2, code: 'MAQ-02', name: 'Prensa' },
      ...result({ performance: null, quality: null, oee: null }),
    },
  ],
};

describe('OeeCard', () => {
  it('muestra el total y una fila por máquina con porcentajes', () => {
    renderWithProviders(<OeeCard data={DATA} error={null} />);

    // Intl usa un espacio duro antes del %
    expect(screen.getByText(/^53,3\s%$/)).toBeInTheDocument();
    const rows = screen.getAllByRole('row');
    // Cabecera + 2 máquinas
    expect(rows).toHaveLength(3);
    expect(within(rows[1]).getByText(/^75\s%$/)).toBeInTheDocument();
    expect(within(rows[1]).getByText(/^50\s%$/)).toBeInTheDocument();
    // Sin ciclo ideal: rendimiento, calidad y OEE con guion
    expect(within(rows[2]).getAllByText('—')).toHaveLength(3);
  });

  it('sin máquinas en el rango muestra un mensaje', () => {
    renderWithProviders(<OeeCard data={{ ...DATA, machines: [] }} error={null} />);

    expect(screen.getByText('Sin datos en este rango')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('muestra el error de la API', () => {
    renderWithProviders(<OeeCard data={undefined} error={new Error('Servidor caído')} />);

    expect(screen.getByText('Servidor caído')).toBeInTheDocument();
  });

  it('colores según las referencias de OEE', () => {
    expect(oeeColor(0.9)).toBe('teal');
    expect(oeeColor(0.6)).toBe('yellow');
    expect(oeeColor(0.59)).toBe('red');
  });
});
