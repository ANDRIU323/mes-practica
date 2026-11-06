import { Button, Group, Input, Modal, NumberInput, SimpleGrid, Stack, Textarea } from '@mantine/core';
import { useForm } from '@mantine/form';
import type { ShopfloorOrder, StopWorkInput } from '../../types/shopfloor';
import type { StopReason } from '../../types/worklog';
import { STOP_REASON_CONFIG, STOP_REASONS } from '../worklogs/stopReason';

interface StopWorkModalProps {
  // null mientras no hay trabajo abierto
  order: ShopfloorOrder | null;
  opened: boolean;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (data: StopWorkInput) => void;
}

export function StopWorkModal({ order, opened, loading, onClose, onSubmit }: StopWorkModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={order ? `Finalizar ${order.code}` : 'Finalizar'}
      size="lg"
      centered
    >
      {/* El Modal desmonta su contenido al cerrarse: cada apertura empieza con el formulario vacío */}
      {order && <StopWorkForm order={order} loading={loading} onSubmit={onSubmit} onCancel={onClose} />}
    </Modal>
  );
}

interface StopWorkFormValues {
  stopReason: StopReason | null;
  producedQty: number | string;
  note: string;
}

interface StopWorkFormProps {
  order: ShopfloorOrder;
  loading?: boolean;
  onSubmit: (data: StopWorkInput) => void;
  onCancel: () => void;
}

function StopWorkForm({ order, loading, onSubmit, onCancel }: StopWorkFormProps) {
  const remaining = Math.max(0, order.quantity - order.producedQty);

  // 2º genérico: tipo que devuelve transformValues, que es lo que recibe onSubmit
  const form = useForm<StopWorkFormValues, (values: StopWorkFormValues) => StopWorkInput>({
    initialValues: { stopReason: null, producedQty: '', note: '' },
    validate: {
      stopReason: (value) => (value === null ? 'Elige un motivo' : null),
      producedQty: (value) => (value === '' ? 'Indica las unidades producidas' : null),
      note: (value, values) =>
        values.stopReason === 'MACHINE_ISSUE' && !value.trim() ? 'Describe la incidencia' : null,
    },
    transformValues: (values) => ({
      // validate ya garantiza que no es null
      stopReason: values.stopReason as StopReason,
      producedQty: Number(values.producedQty),
      note: values.note.trim() || undefined,
    }),
  });

  const isIssue = form.values.stopReason === 'MACHINE_ISSUE';

  return (
    <form onSubmit={form.onSubmit(onSubmit)}>
      <Stack gap="lg">
        <Input.Wrapper label="Motivo" size="lg" withAsterisk error={form.errors.stopReason}>
          <SimpleGrid cols={2} mt="xs">
            {STOP_REASONS.map((reason) => {
              const { label, color } = STOP_REASON_CONFIG[reason];
              const selected = form.values.stopReason === reason;
              return (
                <Button
                  key={reason}
                  size="lg"
                  h={80}
                  color={color}
                  variant={selected ? 'filled' : 'light'}
                  aria-pressed={selected}
                  onClick={() => form.setFieldValue('stopReason', reason)}
                >
                  {label}
                </Button>
              );
            })}
          </SimpleGrid>
        </Input.Wrapper>

        <NumberInput
          label="Unidades producidas en este tramo"
          description={`Llevan ${order.producedQty} de ${order.quantity} (faltan ${remaining})`}
          size="xl"
          withAsterisk
          min={0}
          allowDecimal={false}
          allowNegative={false}
          {...form.getInputProps('producedQty')}
        />

        <Textarea
          label="Nota"
          placeholder={isIssue ? '¿Qué le pasa a la máquina?' : 'Opcional'}
          size="lg"
          withAsterisk={isIssue}
          autosize
          minRows={2}
          maxLength={500}
          {...form.getInputProps('note')}
        />

        <Group grow>
          <Button size="xl" variant="default" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button size="xl" type="submit" color="red" loading={loading}>
            Finalizar
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
