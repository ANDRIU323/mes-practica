import { Button, Group, NumberInput, Select, Stack, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import type { CreateOrderInput } from '../../api/orders';
import { useMachines } from '../../hooks/useMachines';
import type { ProductionOrder } from '../../types/order';
import { MACHINE_STATUS_CONFIG } from '../machines/machineStatus';

interface OrderFormValues {
  code: string;
  product: string;
  // NumberInput devuelve '' cuando el campo está vacío
  quantity: number | string;
  cycleTimeSec: number | string;
  // Select trabaja con strings; null = sin máquina
  machineId: string | null;
}

interface OrderFormProps {
  // Sin orden = crear; con orden = editar
  order?: ProductionOrder;
  loading?: boolean;
  onSubmit: (values: CreateOrderInput) => void;
  onCancel: () => void;
}

export function OrderForm({ order, loading, onSubmit, onCancel }: OrderFormProps) {
  const { data: machines = [], isPending: machinesPending } = useMachines();

  const form = useForm<OrderFormValues, (values: OrderFormValues) => CreateOrderInput>({
    initialValues: {
      code: order?.code ?? '',
      product: order?.product ?? '',
      quantity: order?.quantity ?? '',
      cycleTimeSec: order?.cycleTimeSec ?? '',
      machineId: order?.machineId != null ? String(order.machineId) : null,
    },
    // Mismos límites que createOrderBody en el backend
    validate: {
      code: (value) => {
        const v = value.trim();
        if (!v) return 'El código es obligatorio';
        if (v.length > 30) return 'Máximo 30 caracteres';
        return null;
      },
      product: (value) => {
        const v = value.trim();
        if (!v) return 'El producto es obligatorio';
        if (v.length > 100) return 'Máximo 100 caracteres';
        return null;
      },
      quantity: (value) =>
        typeof value === 'number' && Number.isInteger(value) && value > 0
          ? null
          : 'Debe ser un entero mayor que 0',
      cycleTimeSec: (value) =>
        value === '' || (typeof value === 'number' && value > 0 && value <= 86_400)
          ? null
          : 'Debe ser mayor que 0 (máximo 86400)',
    },
    transformValues: (values) => ({
      code: values.code.trim(),
      product: values.product.trim(),
      quantity: Number(values.quantity),
      machineId: values.machineId ? Number(values.machineId) : null,
      // Vacío = quitarlo (null), para que al editar también se pueda borrar
      cycleTimeSec: values.cycleTimeSec === '' ? null : Number(values.cycleTimeSec),
    }),
  });

  const machineOptions: { value: string; label: string; disabled?: boolean }[] = machines
    .filter((m) => m.status === 'ACTIVE')
    .map((m) => ({ value: String(m.id), label: `${m.code} · ${m.name}` }));

  // Al editar, si la máquina actual ya no está activa se muestra igualmente, pero no se puede elegir
  const currentMachine = machines.find((m) => m.id === order?.machineId);
  if (currentMachine && currentMachine.status !== 'ACTIVE') {
    machineOptions.push({
      value: String(currentMachine.id),
      label: `${currentMachine.code} · ${MACHINE_STATUS_CONFIG[currentMachine.status].label}`,
      disabled: true,
    });
  }

  const handleSubmit = (values: CreateOrderInput) => {
    // El backend rechaza máquinas no activas: al editar solo se envía si ha cambiado
    if (order && !form.isDirty('machineId')) {
      const { machineId: _unchanged, ...rest } = values;
      onSubmit(rest);
    } else {
      onSubmit(values);
    }
  };

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Stack>
        <TextInput
          label="Código"
          placeholder="OF-2026-0001"
          withAsterisk
          maxLength={30}
          {...form.getInputProps('code')}
        />
        <TextInput
          label="Producto"
          placeholder="Eje 20mm"
          withAsterisk
          maxLength={100}
          {...form.getInputProps('product')}
        />
        <NumberInput
          label="Cantidad"
          withAsterisk
          min={1}
          allowDecimal={false}
          allowNegative={false}
          {...form.getInputProps('quantity')}
        />
        <NumberInput
          label="Ciclo ideal (segundos por pieza)"
          description="Opcional. Sin él, la orden no cuenta para el Rendimiento del OEE"
          min={0}
          decimalScale={2}
          decimalSeparator=","
          allowNegative={false}
          {...form.getInputProps('cycleTimeSec')}
        />
        <Select
          label="Máquina"
          placeholder={machinesPending ? 'Cargando máquinas…' : 'Sin máquina'}
          description="Solo se pueden asignar máquinas activas"
          data={machineOptions}
          disabled={machinesPending}
          clearable
          {...form.getInputProps('machineId')}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            {order ? 'Guardar' : 'Crear'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
