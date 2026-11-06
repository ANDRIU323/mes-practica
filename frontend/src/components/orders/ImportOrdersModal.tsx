import { useState } from 'react';
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Group,
  Modal,
  ScrollArea,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { Dropzone, MIME_TYPES, type FileRejection } from '@mantine/dropzone';
import { notifications } from '@mantine/notifications';

import {
  useDownloadOrdersTemplate,
  useImportOrders,
  usePreviewOrdersImport,
} from '../../hooks/useOrders';

const MAX_BYTES = 5 * 1024 * 1024;

interface ImportOrdersModalProps {
  opened: boolean;
  onClose: () => void;
}

export function ImportOrdersModal({ opened, onClose }: ImportOrdersModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const preview = usePreviewOrdersImport();
  const importOrders = useImportOrders();
  const downloadTemplate = useDownloadOrdersTemplate();

  const handleDrop = ([dropped]: File[]) => {
    setFile(dropped);
    preview.mutate(dropped);
  };

  const handleReject = ([rejection]: FileRejection[]) => {
    const tooLarge = rejection.errors.some((error) => error.code === 'file-too-large');
    notifications.show({
      color: 'red',
      message: tooLarge ? 'El archivo supera los 5 MB' : 'Solo se admiten archivos .xlsx',
    });
  };

  // Se limpia al acabar la animación de cierre, para que el contenido no cambie mientras se ve
  const reset = () => {
    setFile(null);
    preview.reset();
  };

  const result = preview.data;
  const errorRows = new Set(result?.errors.map((error) => error.row)).size;
  const canImport = !!file && !!result && result.errors.length === 0 && result.valid.length > 0;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      onExitTransitionEnd={reset}
      title="Importar órdenes desde Excel"
      size="lg"
    >
      <Stack>
        <Text size="sm">
          Primera hoja, cabeceras en la fila 1: <b>codigo</b>, <b>producto</b> y <b>cantidad</b>{' '}
          obligatorias; <b>maquina</b>, <b>empleado</b> (códigos) e <b>inicio_previsto</b> opcionales.
          Máximo 1000 filas y 5 MB. Si hay algún error no se importa ninguna fila.{' '}
          <Anchor
            component="button"
            size="sm"
            onClick={() => downloadTemplate.mutate()}
            disabled={downloadTemplate.isPending}
          >
            Descargar plantilla
          </Anchor>
        </Text>

        <Dropzone
          onDrop={handleDrop}
          onReject={handleReject}
          accept={{ [MIME_TYPES.xlsx]: ['.xlsx'] }}
          maxSize={MAX_BYTES}
          multiple={false}
          loading={preview.isPending}
        >
          {/* Sin eventos de ratón: el clic lo recoge el Dropzone para abrir el selector */}
          <Stack align="center" gap={4} py="lg" style={{ pointerEvents: 'none' }}>
            <Text>Arrastra aquí el archivo .xlsx o haz clic para elegirlo</Text>
            {file && (
              <Text size="sm" c="dimmed">
                {file.name}
              </Text>
            )}
          </Stack>
        </Dropzone>

        {preview.isError && (
          <Alert color="red" title="No se pudo leer el archivo">
            {preview.error.message}
          </Alert>
        )}

        {result && (
          <>
            <Group gap="xs">
              <Badge color="green" variant="light">
                {result.valid.length} válidas
              </Badge>
              <Badge color={errorRows > 0 ? 'red' : 'gray'} variant="light">
                {errorRows} con error
              </Badge>
            </Group>

            {result.errors.length > 0 && (
              <ScrollArea.Autosize mah={300}>
                <Table striped stickyHeader>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Fila</Table.Th>
                      <Table.Th>Campo</Table.Th>
                      <Table.Th>Mensaje</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {result.errors.map((error, i) => (
                      <Table.Tr key={i}>
                        <Table.Td>{error.row}</Table.Td>
                        <Table.Td>{error.field}</Table.Td>
                        <Table.Td>{error.message}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea.Autosize>
            )}
          </>
        )}

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!canImport}
            loading={importOrders.isPending}
            onClick={() => file && importOrders.mutate(file, { onSuccess: onClose })}
          >
            Importar
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
