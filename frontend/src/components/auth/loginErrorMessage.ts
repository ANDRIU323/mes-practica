import { ApiError } from '../../api/apiError';

const timeFormat = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' });

// 423 = cuenta bloqueada por intentos fallidos: el body trae hasta cuándo
export function loginErrorMessage(error: Error) {
  if (error instanceof ApiError && error.status === 423) {
    const { lockedUntil } = error.body as { lockedUntil: string };
    return `${error.message} (hasta las ${timeFormat.format(new Date(lockedUntil))})`;
  }
  return error.message;
}
