import { Alert, Button, Input, PinInput, Stack, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useEmployeeLogin } from '../../hooks/useAuth';
import type { EmployeeLoginInput } from '../../types/auth';
import { loginErrorMessage } from './loginErrorMessage';

// Pensado para la pantalla táctil de planta: campos grandes y PIN numérico
export function EmployeeLoginForm() {
  const loginMutation = useEmployeeLogin();

  const form = useForm<EmployeeLoginInput>({
    initialValues: { code: '', pin: '' },
    validate: {
      code: (value) => (value.trim() ? null : 'El código es obligatorio'),
      pin: (value) => (/^\d{4}$/.test(value) ? null : 'El PIN son 4 dígitos'),
    },
    transformValues: (values) => ({ code: values.code.trim().toUpperCase(), pin: values.pin }),
  });

  const handleSubmit = (values: EmployeeLoginInput) => {
    // Tras un intento fallido se vacía el PIN para volver a teclearlo entero
    loginMutation.mutate(values, { onError: () => form.setFieldValue('pin', '') });
  };

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Stack>
        {loginMutation.isError && (
          <Alert color="red" variant="light">
            {loginErrorMessage(loginMutation.error)}
          </Alert>
        )}

        <TextInput
          label="Código de empleado"
          placeholder="EMP-01"
          size="lg"
          autoComplete="username"
          autoCapitalize="characters"
          withAsterisk
          {...form.getInputProps('code')}
        />
        {/* PinInput no lleva label ni texto de error propios: los pone Input.Wrapper */}
        <Input.Wrapper label="PIN" size="lg" withAsterisk error={form.errors.pin}>
          <PinInput
            length={4}
            type="number"
            mask
            size="xl"
            oneTimeCode={false}
            aria-label="PIN"
            value={form.values.pin}
            onChange={(value) => form.setFieldValue('pin', value)}
            error={!!form.errors.pin}
            mt={4}
          />
        </Input.Wrapper>

        <Button type="submit" size="lg" loading={loginMutation.isPending} fullWidth>
          Entrar
        </Button>
      </Stack>
    </form>
  );
}
