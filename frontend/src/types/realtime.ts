import type { StopReason } from './worklog';

// Mensajes de GET /api/realtime (LiveEvent en backend/src/plugins/events.ts)
export type LiveEvent =
  | { type: 'worklog.started'; orderId: number }
  | { type: 'worklog.closed'; orderId: number; stopReason: StopReason };

export type RealtimeStatus = 'connecting' | 'open' | 'reconnecting';
