import { useState } from 'react';
import {
  Alert,
  Button,
  Center,
  Group,
  Loader,
  Modal,
  SegmentedControl,
  Select,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import type { CreateOrderInput } from '../api/orders';
import { AssignEmployeeModal } from '../components/orders/AssignEmployeeModal';
import { ImportOrdersModal } from '../components/orders/ImportOrdersModal';
import { OrderForm } from '../components/orders/OrderForm';
import { ORDER_STATUS_CONFIG, ORDER_STATUSES } from '../components/orders/orderStatus';
import { OrderTable } from '../components/orders/OrderTable';
import {
  useAssignEmployee,
  useChangeOrderStatus,
  useCreateOrder,
  useDeleteOrder,
  useExportOrders,
  useOrders,
  useUpdateOrder,
} from '../hooks/useOrders';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setOrderStatusFilter } from '../store/uiSlice';
import type { OrderStatus, ProductionOrder } from '../types/order';

// SegmentedControl solo admite strings: 'ALL' representa el null de Redux
const ALL = 'ALL';
const FILTER_OPTIONS = [
  { value: ALL, label: 'Todas' },
  ...ORDER_STATUSES.map((status) => ({ value: status, label: ORDER_STATUS_CONFIG[status].label })),
];

export function OrdersPage() {
  const statusFilter = useAppSelector((state) => state.ui.orderStatusFilter);
  const dispatch = useAppDispatch();
  const { data: orders, isPending, isError, error } = useOrders(statusFilter);
  const createOrder = useCreateOrder();
  const updateOrder = useUpdateOrder();
  const changeStatus = useChangeOrderStatus();
  const deleteOrder = useDeleteOrder();
  const assignEmployee = useAssignEmployee();
  const exportOrders = useExportOrders();

  // No se limpia al cerrar, igual que editingOrder
  const [assigningOrder, setAssigningOrder] = useState<ProductionOrder | null>(null);
  const [assignOpened, setAssignOpened] = useState(false);
  const closeAssign = () => setAssignOpened(false);

  const [importOpened, setImportOpened] = useState(false);

  const [formOpened, setFormOpened] = useState(false);
  // undefined = crear. No se limpia al cerrar para que el título no cambie durante la animación
  const [editingOrder, setEditingOrder] = useState<ProductionOrder | undefined>();

  const openCreate = () => {
    setEditingOrder(undefined);
    setFormOpened(true);
  };

  const openEdit = (order: ProductionOrder) => {
    setEditingOrder(order);
    setFormOpened(true);
  };

  const closeForm = () => setFormOpened(false);

  const handleSubmit = (values: CreateOrderInput) => {
    if (editingOrder) {
      updateOrder.mutate({ id: editingOrder.id, data: values }, { onSuccess: closeForm });
    } else {
      createOrder.mutate(values, { onSuccess: closeForm });
    }
  };

  const handleFilterChange = (value: string | null) => {
    dispatch(setOrderStatusFilter(!value || value === ALL ? null : (value as OrderStatus)));
  };

  let content;
  if (isPending) {
    content = (
      <Center py="xl">
        <Loader />
      </Center>
    );
  } else if (isError) {
    content = (
      <Alert color="red" title="No se pudieron cargar las órdenes">
        {error.message}
      </Alert>
    );
  } else if (orders.length === 0) {
    content = (
      <Text c="dimmed" ta="center" py="xl">
        {statusFilter
          ? `No hay órdenes en estado "${ORDER_STATUS_CONFIG[statusFilter].label}".`
          : 'No hay órdenes de producción.'}
      </Text>
    );
  } else {
    content = (
      <OrderTable
        orders={orders}
        onEdit={openEdit}
        onAssign={(order) => {
          setAssigningOrder(order);
          setAssignOpened(true);
        }}
        onChangeStatus={(order, status) => changeStatus.mutate({ id: order.id, data: { status } })}
        onDelete={(order) => deleteOrder.mutate(order.id)}
      />
    );
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Órdenes</Title>
        <Group gap="sm">
          {/* Los dos controles comparten el valor de Redux; solo se ve uno según el ancho */}
          <SegmentedControl
            visibleFrom="sm"
            data={FILTER_OPTIONS}
            value={statusFilter ?? ALL}
            onChange={handleFilterChange}
          />
          <Select
            hiddenFrom="sm"
            aria-label="Filtrar por estado"
            data={FILTER_OPTIONS}
            value={statusFilter ?? ALL}
            onChange={handleFilterChange}
            allowDeselect={false}
            w={140}
          />
          <Button variant="default" onClick={() => setImportOpened(true)}>
            Importar Excel
          </Button>
          <Button
            variant="default"
            loading={exportOrders.isPending}
            disabled={!orders?.length}
            onClick={() => exportOrders.mutate(statusFilter)}
          >
            Exportar Excel
          </Button>
          <Button onClick={openCreate}>Nueva orden</Button>
        </Group>
      </Group>
      {content}

      <Modal
        opened={formOpened}
        onClose={closeForm}
        title={editingOrder ? `Editar ${editingOrder.code}` : 'Nueva orden'}
      >
        <OrderForm
          order={editingOrder}
          loading={createOrder.isPending || updateOrder.isPending}
          onSubmit={handleSubmit}
          onCancel={closeForm}
        />
      </Modal>

      <AssignEmployeeModal
        order={assigningOrder}
        opened={assignOpened}
        loading={assignEmployee.isPending}
        onClose={closeAssign}
        onSubmit={(data) =>
          assigningOrder &&
          assignEmployee.mutate({ id: assigningOrder.id, data }, { onSuccess: closeAssign })
        }
      />

      <ImportOrdersModal opened={importOpened} onClose={() => setImportOpened(false)} />
    </Stack>
  );
}
