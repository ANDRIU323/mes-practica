import { Affix, Center, Paper, Stack, Tabs, Title } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { Navigate, useLocation } from 'react-router-dom';

import { AdminLoginForm } from '../components/auth/AdminLoginForm';
import { EmployeeLoginForm } from '../components/auth/EmployeeLoginForm';
import { HOME_PATH } from '../components/auth/homePath';
import { ColorSchemeToggle } from '../components/layout/ColorSchemeToggle';
import { useAppSelector } from '../store/hooks';
import { selectCurrentUser } from '../store/authSlice';

type LoginTab = 'admin' | 'employee';

export function LoginPage() {
  const location = useLocation();
  const user = useAppSelector(selectCurrentUser);
  // Se recuerda la última pestaña: la pantalla de planta abre directamente en "Empleado"
  const [tab, setTab] = useLocalStorage<LoginTab>({ key: 'mes-login-tab', defaultValue: 'admin' });

  // Página que se intentaba abrir antes de ser redirigido al login
  const from = (location.state as { from?: string } | null)?.from;

  // Con sesión se sale de aquí. Si "from" no es de su zona, ProtectedRoute lo recoloca
  if (user) return <Navigate to={from ?? HOME_PATH[user.role]} replace />;

  return (
    <Center mih="100vh" p="md">
      <Affix position={{ top: 16, right: 16 }}>
        <ColorSchemeToggle />
      </Affix>
      <Paper withBorder shadow="sm" p="xl" radius="md" w="100%" maw={420}>
        <Stack>
          <Title order={2} ta="center">
            MES Práctica
          </Title>

          <Tabs value={tab} onChange={(value) => setTab(value as LoginTab)} keepMounted={false}>
            <Tabs.List grow mb="md">
              <Tabs.Tab value="admin">Administrador</Tabs.Tab>
              <Tabs.Tab value="employee">Empleado</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="admin">
              <AdminLoginForm />
            </Tabs.Panel>
            <Tabs.Panel value="employee">
              <EmployeeLoginForm />
            </Tabs.Panel>
          </Tabs>
        </Stack>
      </Paper>
    </Center>
  );
}
