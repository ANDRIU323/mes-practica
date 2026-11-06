// Error de una respuesta no 2xx: además del mensaje guarda el código y el body,
// para las respuestas que traen datos útiles (p. ej. el 409 al cerrar un turno).
// En su propio archivo para que los tests puedan mockear client.ts y seguir usándolo
export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}
