import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { changePassword, employeeLogin, login } from '../api/auth';
import type { ChangePasswordInput, EmployeeLoginInput, LoginInput, LoginResponse } from '../types/auth';
import { useAppDispatch } from '../store/hooks';
import { loggedIn, loggedOut } from '../store/authSlice';

// Común a los dos logins: se descarta cualquier dato de una sesión anterior antes de entrar
function useStartSession() {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  return (session: LoginResponse) => {
    queryClient.clear();
    dispatch(loggedIn(session));
  };
}

export function useLogin() {
  const startSession = useStartSession();
  return useMutation({
    mutationFn: (data: LoginInput) => login(data),
    onSuccess: startSession,
  });
}

export function useEmployeeLogin() {
  const startSession = useStartSession();
  return useMutation({
    mutationFn: (data: EmployeeLoginInput) => employeeLogin(data),
    onSuccess: startSession,
  });
}

// La sesión sigue abierta: el token actual vale hasta que caduque
export function useChangePassword() {
  return useMutation({
    mutationFn: (data: ChangePasswordInput) => changePassword(data),
    onSuccess: () => {
      notifications.show({ color: 'green', message: 'Contraseña cambiada' });
    },
  });
}

export function useLogout() {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  return () => {
    // Primero se cierra la sesión (las rutas protegidas se desmontan) y luego se vacía la caché
    dispatch(loggedOut());
    queryClient.clear();
  };
}
