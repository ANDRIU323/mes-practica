import { EventEmitter } from 'node:events';
import fp from 'fastify-plugin';
import type { StopReason } from '@prisma/client';

// Bus de eventos en memoria: las rutas publican lo que ha cambiado y la ruta
// /api/realtime lo reenvía a los sockets abiertos. Vive en un solo proceso:
// con varias instancias del backend haría falta algo compartido (p. ej. LISTEN/NOTIFY de Postgres).

export type LiveEvent =
  | { type: 'worklog.started'; orderId: number }
  | { type: 'worklog.closed'; orderId: number; stopReason: StopReason };

type Listener = (event: LiveEvent) => void;

export class LiveEvents {
  private emitter = new EventEmitter();

  constructor() {
    // Un listener por pestaña de admin abierta: sin límite para que Node no avise
    this.emitter.setMaxListeners(0);
  }

  publish(event: LiveEvent) {
    this.emitter.emit('event', event);
  }

  // Devuelve la función que da de baja al listener
  subscribe(listener: Listener) {
    this.emitter.on('event', listener);
    return () => {
      this.emitter.off('event', listener);
    };
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    events: LiveEvents;
  }
}

export default fp(async (app) => {
  app.decorate('events', new LiveEvents());
});
