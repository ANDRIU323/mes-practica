import { API_BASE_URL } from './baseUrl';

// http(s)://…/api → ws(s)://…/api/realtime?token=…
// El navegador no deja poner cabeceras al abrir un WebSocket: el token va en la URL
export function realtimeUrl(token: string) {
  const url = new URL(`${API_BASE_URL}/realtime`, window.location.href);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.searchParams.set('token', token);
  return url.toString();
}
