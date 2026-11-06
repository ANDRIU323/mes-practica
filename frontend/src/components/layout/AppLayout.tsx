import { AppShell, Badge, Burger, Button, Group, Text, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Outlet } from 'react-router-dom';

import { ColorSchemeToggle } from './ColorSchemeToggle';
import { ChangePasswordModal } from '../auth/ChangePasswordModal';
import { Navbar } from './Navbar';
import { useLogout } from '../../hooks/useAuth';
import { useRealtime } from '../../hooks/useRealtime';
import { useAppSelector } from '../../store/hooks';
import { selectCurrentUser } from '../../store/authSlice';

export function AppLayout() {
  const [opened, { toggle, close }] = useDisclosure();
  const [passwordOpened, { open: openPassword, close: closePassword }] = useDisclosure();
  const user = useAppSelector(selectCurrentUser);
  const logout = useLogout();
  // Un solo socket para todo el panel: vive en el layout, no en cada página
  const realtime = useRealtime();

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 220, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group wrap="nowrap">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Title order={3}>MES Práctica</Title>
          </Group>
          <Group gap="sm" wrap="nowrap">
            <Badge variant="dot" color={realtime === 'open' ? 'teal' : 'gray'} visibleFrom="sm">
              {realtime === 'open' ? 'En directo' : 'Conectando…'}
            </Badge>
            <Text size="sm" visibleFrom="xs" truncate maw={200}>
              {user?.name}
            </Text>
            <ColorSchemeToggle size="md" />
            <Button variant="subtle" size="xs" onClick={openPassword} visibleFrom="xs">
              Contraseña
            </Button>
            <Button variant="default" size="xs" onClick={logout}>
              Cerrar sesión
            </Button>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        <Navbar onNavigate={close} />
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>

      <ChangePasswordModal opened={passwordOpened} onClose={closePassword} />
    </AppShell>
  );
}
