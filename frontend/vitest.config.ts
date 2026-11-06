import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

// Reutiliza la configuración de Vite (plugin de React) y añade la de los tests
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // DOM simulado en Node: los componentes se renderizan sin navegador
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
    },
  }),
);
