import type { ReactElement } from 'react';
import { MantineProvider } from '@mantine/core';
import { configureStore } from '@reduxjs/toolkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import authReducer from '../store/authSlice';
import uiReducer from '../store/uiSlice';

// Store y caché nuevos en cada render: un test no hereda el estado de otro.
// Sin el listener de authSlice, para no escribir en localStorage.
function createTestStore() {
  return configureStore({ reducer: { ui: uiReducer, auth: authReducer } });
}

export function renderWithProviders(ui: ReactElement) {
  // retry: false → un error de la API se muestra al momento, sin reintentos
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const store = createTestStore();

  const result = render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        {/* env="test": sin transiciones ni portales, los modales se pintan al momento */}
        <MantineProvider env="test">{ui}</MantineProvider>
      </QueryClientProvider>
    </Provider>,
  );
  // store y queryClient, para tests que despachan acciones o espían la caché
  return { ...result, store, queryClient };
}
