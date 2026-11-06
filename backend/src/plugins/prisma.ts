import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';

// Registra Prisma dentro de Fastify como app.db (mismo patrón que MES-Api).
// Así cualquier ruta puede usar request.server.db o app.db.

// omit global: pinHash no sale en ninguna consulta salvo que se pida con
// omit: { pinHash: false } (solo el login de empleado)
function createClient() {
  return new PrismaClient({ omit: { employee: { pinHash: true } } });
}

export type Db = ReturnType<typeof createClient>;

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
  }
}

export default fp(async (app) => {
  const prisma = createClient();
  await prisma.$connect();

  app.decorate('db', prisma);

  // Cierra la conexión cuando se apaga el servidor
  app.addHook('onClose', async (instance) => {
    await instance.db.$disconnect();
  });
});
