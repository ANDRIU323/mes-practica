// Carga las variables de .env (PORT, DATABASE_URL...)
try {
  process.loadEnvFile();
} catch {
  // Si no hay .env, se usan los valores por defecto
}

import { buildApp } from './app.js';

const app = await buildApp();
const port = Number(process.env.PORT ?? 3000);

try {
  await app.listen({ port, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
