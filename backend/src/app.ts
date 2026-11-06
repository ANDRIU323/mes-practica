import Fastify, { type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import websocket from '@fastify/websocket';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';

import prismaPlugin from './plugins/prisma.js';
import authPlugin from './plugins/auth.js';
import eventsPlugin from './plugins/events.js';
import swaggerPlugin from './plugins/swagger.js';
import machineRoutes from './modules/machines/machines.routes.js';
import orderRoutes from './modules/orders/orders.routes.js';
import authRoutes from './modules/auth/auth.routes.js';
import employeeRoutes from './modules/employees/employees.routes.js';
import shopfloorRoutes from './modules/shopfloor/shopfloor.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';
import shiftRoutes from './modules/shifts/shifts.routes.js';
import realtimeRoutes from './modules/realtime/realtime.routes.js';
import planningRoutes from './modules/planning/planning.routes.js';
import { IMPORT_MAX_BYTES } from './modules/orders/orders.import.js';

// logger: false en los tests, para que la salida solo muestre los resultados
export async function buildApp({ logger = true }: { logger?: boolean } = {}) {
  const app = Fastify({
    logger: logger && {
      serializers: {
        // El WebSocket lleva el token en ?token=: que no acabe en los logs
        req: (req: FastifyRequest) => ({
          method: req.method,
          url: req.url.replace(/([?&]token=)[^&]*/, '$1***'),
          remoteAddress: req.ip,
        }),
      },
    },
  }).withTypeProvider<ZodTypeProvider>();

  // Zod se encarga de validar entrada y salida de las rutas
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // CORS_ORIGIN admite varios orígenes separados por comas
  const corsOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',').map((o) => o.trim());
  await app.register(cors, { origin: corsOrigins });
  await app.register(prismaPlugin);
  await app.register(authPlugin);
  await app.register(eventsPlugin);
  // Antes de las rutas: las documenta según se van registrando
  await app.register(swaggerPlugin);
  // Antes de las rutas: las marcadas con websocket: true aceptan el upgrade
  await app.register(websocket);
  // global: false → solo limita las rutas que lo piden en config.rateLimit
  await app.register(rateLimit, {
    global: false,
    errorResponseBuilder: (_req, ctx) => ({
      statusCode: 429,
      message: `Demasiados intentos. Prueba de nuevo en ${Math.ceil(ctx.ttl / 1000)} s`,
    }),
  });

  // Rutas públicas
  await app.register(authRoutes, { prefix: '/api/auth' });
  app.get('/api/health', async () => ({ ok: true }));

  // Rutas de administración: el hook solo afecta a lo registrado dentro de este
  // contexto, así que cualquier módulo nuevo que se añada aquí exige rol ADMIN
  await app.register(
    async (adminApp) => {
      adminApp.addHook('onRequest', adminApp.requireRole('ADMIN'));
      // Subida de archivos solo para ADMIN: un archivo por petición, como mucho 5 MB.
      // Pasar el límite da 413 al leer el archivo (throwFileSizeLimit, activo por defecto)
      await adminApp.register(multipart, {
        limits: { fileSize: IMPORT_MAX_BYTES, files: 1 },
      });
      await adminApp.register(machineRoutes, { prefix: '/machines' });
      await adminApp.register(orderRoutes, { prefix: '/orders' });
      await adminApp.register(employeeRoutes, { prefix: '/employees' });
      await adminApp.register(dashboardRoutes, { prefix: '/dashboard' });
      await adminApp.register(shiftRoutes, { prefix: '/shifts' });
      await adminApp.register(planningRoutes, { prefix: '/planning' });
      await adminApp.register(realtimeRoutes, { prefix: '/realtime' });
    },
    { prefix: '/api' },
  );

  // Rutas de planta: solo rol EMPLOYEE
  await app.register(
    async (employeeApp) => {
      employeeApp.addHook('onRequest', employeeApp.requireRole('EMPLOYEE'));
      await employeeApp.register(shopfloorRoutes, { prefix: '/shopfloor' });
    },
    { prefix: '/api' },
  );

  return app;
}
