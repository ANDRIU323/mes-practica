import { defineConfig } from 'vitest/config';

// Antes que nada: los tests nunca deben usar la BD de desarrollo del .env
process.loadEnvFile('.env.test');

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['./test/globalSetup.ts'],
    // Todos los archivos comparten la misma BD y la vacían antes de cada test:
    // si se ejecutaran a la vez, uno borraría los datos de otro
    fileParallelism: false,
    // bcrypt y las transacciones tardan algo más que el valor por defecto en Windows
    testTimeout: 15_000,
  },
});
