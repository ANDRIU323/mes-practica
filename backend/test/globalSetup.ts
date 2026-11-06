import { execSync } from 'node:child_process';

// Se ejecuta una vez antes de todos los tests: aplica las migraciones (incluido el SQL
// a mano: índices parciales y CHECK) en la BD de test
export default function setup() {
  const url = process.env.DATABASE_URL ?? '';
  // Salvaguarda: resetDb vacía todas las tablas, nunca contra una BD que no sea de test
  if (!url.includes('_test')) {
    throw new Error(`DATABASE_URL no apunta a una BD de test: ${url}`);
  }

  try {
    execSync('npx prisma migrate deploy', { stdio: 'pipe', env: process.env });
  } catch (e) {
    const output = (e as { stderr?: Buffer }).stderr?.toString() ?? '';
    throw new Error(
      `No se pudieron aplicar las migraciones en la BD de test. ¿Está arrancada?\n` +
        `  docker compose up -d db-test\n\n${output}`,
    );
  }
}
