import { useEffect, useState } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { realtimeUrl } from '../api/realtime';
import { useAppSelector } from '../store/hooks';
import { selectToken } from '../store/authSlice';
import type { LiveEvent, RealtimeStatus } from '../types/realtime';
import { DASHBOARD_KEY, EMPLOYEES_KEY, MACHINES_KEY, ORDERS_KEY, SHIFTS_KEY } from './queryKeys';

// Espera antes de reconectar: se duplica en cada intento fallido hasta el máximo
const RECONNECT_MIN_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

// Todo lo que cambia al abrir o cerrar un WorkLog: órdenes (estado, producido, quién trabaja),
// máquinas (MAINTENANCE con MACHINE_ISSUE, horas del detalle), dashboard, turnos y horas de empleados.
// Solo se vuelven a pedir las consultas que hay en pantalla; el resto quedan como antiguas
const WORKLOG_KEYS = [ORDERS_KEY, MACHINES_KEY, DASHBOARD_KEY, SHIFTS_KEY, EMPLOYEES_KEY];

function invalidateWorkLogData(queryClient: QueryClient) {
  for (const queryKey of WORKLOG_KEYS) queryClient.invalidateQueries({ queryKey });
}

// Mantiene abierto el WebSocket de /api/realtime mientras haya sesión (solo ADMIN)
// e invalida la caché cuando el servidor avisa: sustituye al sondeo por intervalo
export function useRealtime(): RealtimeStatus {
  const token = useAppSelector(selectToken);
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<RealtimeStatus>('connecting');

  useEffect(() => {
    if (!token) return;

    let socket: WebSocket;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    // Al desmontar se cierra a propósito: ese close no debe reconectar
    let stopped = false;

    function connect() {
      socket = new WebSocket(realtimeUrl(token!));

      socket.onopen = () => {
        // Mientras estaba cortado se han podido perder avisos: se refresca todo
        if (attempt > 0) invalidateWorkLogData(queryClient);
        attempt = 0;
        setStatus('open');
      };

      socket.onmessage = (message) => {
        const event = JSON.parse(message.data) as LiveEvent;
        if (event.type === 'worklog.started' || event.type === 'worklog.closed') {
          invalidateWorkLogData(queryClient);
        }
      };

      // El navegador no expone el motivo (un 401 del upgrade llega como un corte más).
      // Si el token caducó, la siguiente petición normal da 401 y cierra la sesión
      socket.onclose = () => {
        if (stopped) return;
        setStatus('reconnecting');
        const delay = Math.min(RECONNECT_MIN_MS * 2 ** attempt, RECONNECT_MAX_MS);
        attempt++;
        retryTimer = setTimeout(connect, delay);
      };
    }

    connect();
    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      socket.close();
    };
  }, [token, queryClient]);

  return status;
}
