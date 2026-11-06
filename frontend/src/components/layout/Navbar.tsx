import { NavLink } from '@mantine/core';
import { Link, useLocation } from 'react-router-dom';

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/machines', label: 'Máquinas' },
  { to: '/orders', label: 'Órdenes' },
  { to: '/planning', label: 'Planificación' },
  { to: '/employees', label: 'Empleados' },
  { to: '/reports', label: 'Informes' },
  { to: '/shifts', label: 'Turnos' },
];

export function Navbar({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();

  return links.map((link) => (
    <NavLink
      key={link.to}
      component={Link}
      to={link.to}
      label={link.label}
      active={pathname === link.to}
      onClick={onNavigate}
    />
  ));
}
