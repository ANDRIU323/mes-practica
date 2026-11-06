import { Alert, Button, Group, Modal, PasswordInput, Stack } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useChangePassword } from '../../hooks/useAuth';
import { loginErrorMessage } from './loginErrorMessage';

interface ChangePasswordModalProps {
  opened: boolean;
  onClose: () => void;
}

interface FormValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export function ChangePasswordModal({ opened, onClose }: ChangePasswordModalProps) {
  const changePassword = useChangePassword();

  // Mismas reglas que changePasswordBody en el backend, más la confirmación
  const form = useForm<FormValues>({
    initialValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
    validate: {
      currentPassword: (value) => (value ? null : 'Obligatoria'),
      newPassword: (value, values) => {
        if (value.length < 8) return 'Mínimo 8 caracteres';
        if (value === values.currentPassword) return 'Debe ser distinta de la actual';
        return null;
      },
      confirmPassword: (value, values) => (value === values.newPassword ? null : 'No coincide'),
    },
  });

  const close = () => {
    form.reset();
    changePassword.reset();
    onClose();
  };

  const handleSubmit = ({ currentPassword, newPassword }: FormValues) => {
    changePassword.mutate({ currentPassword, newPassword }, { onSuccess: close });
  };

  return (
    <Modal opened={opened} onClose={close} title="Cambiar contraseña">
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack>
          {changePassword.isError && (
            <Alert color="red" variant="light">
              {loginErrorMessage(changePassword.error)}
            </Alert>
          )}
          <PasswordInput
            label="Contraseña actual"
            autoComplete="current-password"
            withAsterisk
            {...form.getInputProps('currentPassword')}
          />
          <PasswordInput
            label="Contraseña nueva"
            autoComplete="new-password"
            withAsterisk
            {...form.getInputProps('newPassword')}
          />
          <PasswordInput
            label="Repite la contraseña nueva"
            autoComplete="new-password"
            withAsterisk
            {...form.getInputProps('confirmPassword')}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={close}>
              Cancelar
            </Button>
            <Button type="submit" loading={changePassword.isPending}>
              Guardar
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
