import { store } from '../store';
import { loggedOut, selectToken } from '../store/authSlice';
import { ApiError } from './apiError';
import { API_BASE_URL } from './baseUrl';

// Hace la petición con el token y convierte los errores en Error; el que llama lee el body
async function request(path: string, options: RequestInit = {}): Promise<Response> {
  const token = selectToken(store.getState());

  const headers = new Headers(options.headers);
  // Solo se manda Content-Type si hay body: Fastify rechaza un JSON vacío.
  // Con FormData lo pone el navegador, con el boundary que separa las partes
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  // Token caducado o inválido: se cierra la sesión y las rutas protegidas llevan al login.
  // Sin token (p. ej. un login fallido) el 401 es un error normal y no cierra nada.
  // Si mientras tanto se inició otra sesión, una respuesta antigua no debe cerrarla.
  if (res.status === 401 && token && selectToken(store.getState()) === token) {
    store.dispatch(loggedOut());
    throw new Error('La sesión ha caducado, vuelve a iniciar sesión');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.message ?? body?.error ?? `Error ${res.status} en ${path}`, body);
  }

  return res;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await request(path, options);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// Descargas de archivos: un enlace normal no mandaría el token
export async function apiFetchBlob(path: string): Promise<Blob> {
  const res = await request(path);
  return res.blob();
}
