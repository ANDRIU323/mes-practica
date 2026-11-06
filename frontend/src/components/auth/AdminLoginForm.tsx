import { Alert, Button, PasswordInput, Stack, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useLogin } from '../../hooks/useAuth';
import type { LoginInput } from '../../types/auth';
import { loginErrorMessage } from './loginErrorMessage';

export function AdminLoginForm() {
  const loginMutation = useLogin();

  const form = useForm<LoginInput>({
    initialValues: { email: '', password: '' },
    validate: {
      email: (value) => (/^\S+@\S+\.\S+$/.test(value.trim()) ? null : 'Email no válido'),
      password: (value) => (value ? null : 'La contraseña es obligatoria'),
    },
    transformValues: (values) => ({ ...values, email: values.email.trim() }),
  });

  return (
    <form onSubmit={form.onSubmit((values) => loginMutation.mutate(values))}>
      <Stack>
        {loginMutation.isError && (
          <Alert color="red" variant="light">
            {loginErrorMessage(loginMutation.error)}
          </Alert>
        )}

        <TextInput
          label="Email"
          placeholder="admin@mes.local"
          autoComplete="username"
          withAsterisk
          {...form.getInputProps('email')}
        />
        <PasswordInput
          label="Contraseña"
          autoComplete="current-password"
          withAsterisk
          {...form.getInputProps('password')}
        />

        <Button type="submit" loading={loginMutation.isPending} fullWidth>
          Iniciar sesión
        </Button>
      </Stack>
    </form>
  );
}
