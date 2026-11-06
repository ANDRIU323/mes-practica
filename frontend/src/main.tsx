import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { DatesProvider } from '@mantine/dates';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import 'dayjs/locale/es';

import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/dropzone/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/charts/styles.css';

import { store } from './store';
import { useAppSelector } from './store/hooks';
import { selectColorScheme } from './store/uiSlice';
import App from './App';

const queryClient = new QueryClient();

// El tema vive en Redux; Mantine solo lo aplica
function ThemedMantineProvider({ children }: { children: ReactNode }) {
  const colorScheme = useAppSelector(selectColorScheme);
  return <MantineProvider forceColorScheme={colorScheme}>{children}</MantineProvider>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <ThemedMantineProvider>
          {/* Calendarios en español y con la semana empezando en lunes */}
          <DatesProvider settings={{ locale: 'es', firstDayOfWeek: 1 }}>
            <Notifications />
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </DatesProvider>
        </ThemedMantineProvider>
      </QueryClientProvider>
    </Provider>
  </StrictMode>,
);
