import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAppSelector } from '../../store/hooks';
import { selectCurrentUser } from '../../store/authSlice';
import type { Role } from '../../types/auth';
import { HOME_PATH } from './homePath';

// Sin sesión, cualquier ruta hija redirige al login recordando a dónde se quería ir.
// Con sesión de otro rol, a la zona de ese rol.
export function ProtectedRoute({ role }: { role: Role }) {
  const user = useAppSelector(selectCurrentUser);
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  if (user.role !== role) {
    return <Navigate to={HOME_PATH[user.role]} replace />;
  }
  return <Outlet />;
}
