import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

// Cada cuánto se comprueba que el cliente sigue ahí: si no contesta al ping
// anterior, la conexión está muerta (portátil suspendido, red caída) y se corta
const HEARTBEAT_MS = 30_000;

// El token lo lee auth.ts (extractToken); aquí solo se declara
const realtimeQuery = z.object({ token: z.string().optional() });

const realtimeRoutes: FastifyPluginAsyncZod = async (app) => {
  // GET /api/realtime (WebSocket) -> reenvía cada LiveEvent como JSON.
  // Los hooks de autenticación corren antes del upgrade: sin token válido, 401 por HTTP
  app.get('/', { websocket: true, schema: { querystring: realtimeQuery } }, (socket) => {
    const unsubscribe = app.events.subscribe((event) => socket.send(JSON.stringify(event)));

    let alive = true;
    socket.on('pong', () => {
      alive = true;
    });
    const heartbeat = setInterval(() => {
      if (!alive) return socket.terminate();
      alive = false;
      socket.ping();
    }, HEARTBEAT_MS);

    socket.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });
};

export default realtimeRoutes;
