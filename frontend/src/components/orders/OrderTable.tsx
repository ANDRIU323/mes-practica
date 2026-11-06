import { useState } from 'react';
import { Badge, Button, Group, Menu, Modal, Progress, Stack, Table, Text } from '@mantine/core';
import type { OrderStatus, ProductionOrder } from '../../types/order';
import { ORDER_STATUS_CONFIG, ORDER_TRANSITIONS } from './orderStatus';
import { StatusBadge } from './StatusBadge';

interface OrderTableProps {
  orders: ProductionOrder[];
  onEdit: (order: ProductionOrder) => void;
  onAssign: (order: ProductionOrder) => void;
  onChangeStatus: (order: ProductionOrder, status: OrderStatus) => void;
  onDelete: (order: ProductionOrder) => void;
}

export function OrderTable({ orders, onEdit, onAssign, onChangeStatus, onDelete }: OrderTableProps) {
  // No se limpia al cerrar para que el texto no cambie durante la animación
  const [orderToDelete, setOrderToDelete] = useState<ProductionOrder | null>(null);
  const [deleteOpened, setDeleteOpened] = useState(false);

  const askDelete = (order: ProductionOrder) => {
    setOrderToDelete(order);
    setDeleteOpened(true);
  };

  const closeDelete = () => setDeleteOpened(false);

  const confirmDelete = () => {
    if (orderToDelete) onDelete(orderToDelete);
    closeDelete();
  };

  const rows = orders.map((order) => {
    const percent = Math.min(100, Math.round((order.producedQty / order.quantity) * 100));
    const transitions = ORDER_TRANSITIONS[order.status];
    // Con alguien trabajando no se termina, cancela ni reasigna hasta que finalice en planta
    const someoneWorking = order.openWorkLog !== null;

    return (
      <Table.Tr key={order.id}>
        <Table.Td>{order.code}</Table.Td>
        <Table.Td>{order.product}</Table.Td>
        <Table.Td>{order.machine?.code ?? '—'}</Table.Td>
        <Table.Td>
          <Group gap={6} wrap="nowrap">
            {order.assignedEmployee?.name ?? '—'}
            {someoneWorking && (
              <Badge size="xs" variant="dot">
                Trabajando
              </Badge>
            )}
          </Group>
        </Table.Td>
        <Table.Td ta="right">{order.quantity}</Table.Td>
        <Table.Td>
          <Stack gap={4}>
            <Progress value={percent} color={ORDER_STATUS_CONFIG[order.status].color} size="sm" />
            <Text size="xs" c="dimmed">
              {order.producedQty} / {order.quantity} ({percent}%)
            </Text>
          </Stack>
        </Table.Td>
        <Table.Td>
          <StatusBadge status={order.status} />
        </Table.Td>
        <Table.Td>
          <Group justify="flex-end">
            <Menu position="bottom-end" withinPortal shadow="md">
              <Menu.Target>
                <Button size="xs" variant="light">
                  Acciones
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item onClick={() => onEdit(order)}>Editar</Menu.Item>
                {/* Igual que el backend: las órdenes terminadas o canceladas no cambian de empleado */}
                <Menu.Item disabled={transitions.length === 0} onClick={() => onAssign(order)}>
                  Asignar / cambiar empleado
                </Menu.Item>

                <Menu.Label>Cambiar estado</Menu.Label>
                {transitions.length === 0 ? (
                  <Menu.Item disabled>Estado final</Menu.Item>
                ) : (
                  transitions.map((status) => (
                    <Menu.Item
                      key={status}
                      color={status === 'CANCELLED' ? 'red' : undefined}
                      disabled={someoneWorking && status !== 'IN_PROGRESS'}
                      onClick={() => onChangeStatus(order, status)}
                    >
                      Pasar a {ORDER_STATUS_CONFIG[status].label}
                    </Menu.Item>
                  ))
                )}

                <Menu.Divider />
                <Menu.Item color="red" onClick={() => askDelete(order)}>
                  Borrar
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Table.Td>
      </Table.Tr>
    );
  });

  // Por debajo de minWidth la tabla hace scroll horizontal en vez de aplastar las columnas
  return (
    <>
      <Table.ScrollContainer minWidth={940}>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Código</Table.Th>
              <Table.Th>Producto</Table.Th>
              <Table.Th>Máquina</Table.Th>
              <Table.Th>Empleado</Table.Th>
              <Table.Th ta="right">Cantidad</Table.Th>
              <Table.Th w={160}>Progreso</Table.Th>
              <Table.Th>Estado</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>{rows}</Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      <Modal
        opened={deleteOpened}
        onClose={closeDelete}
        title="Borrar orden"
        centered
        size="sm"
      >
        <Stack>
          <Text size="sm">¿Borrar la orden {orderToDelete?.code}? No se puede deshacer.</Text>
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={closeDelete}>
              Cancelar
            </Button>
            <Button color="red" onClick={confirmDelete}>
              Borrar
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
