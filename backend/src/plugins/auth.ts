import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import bcrypt from 'bcrypt';
import type { FastifyReply, FastifyRequest } from 'fastify';

// Autenticación con JWT: registra @fastify/jwt y el decorador app.requireRole,
// que crea un hook que exige un token válido con alguno de los roles indicados.

type AuthHook = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

declare module 'fastify' {
  interface FastifyInstance {
    requireRole: (...roles: TokenUser['role'][]) => AuthHook;
  }
}

// Contenido del token según el rol: el admin es un User (sub = User.id),
// el empleado de planta un Employee
export type TokenUser =
  | { role: 'ADMIN'; sub: number }
  | { role: 'EMPLOYEE'; employeeId: number };

// Forma de request.user tras verificar el token
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: TokenUser;
    user: TokenUser;
  }
}

const SALT_ROUNDS = 10;

export function hashPassword(password: string) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export default fp(async (app) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('Falta JWT_SECRET en .env');
  }

  await app.register(jwt, {
    secret,
    sign: { expiresIn: '8h' },
    verify: {
      // El navegador no deja poner cabeceras al abrir un WebSocket: solo en ese caso
      // se acepta el token en ?token=. El resto de rutas siguen exigiendo la cabecera
      extractToken: (request) => {
        const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
        if (scheme?.toLowerCase() === 'bearer' && token) return token;
        if (request.headers.upgrade?.toLowerCase() === 'websocket') {
          return (request.query as { token?: string }).token;
        }
      },
    },
  });

  app.decorate('requireRole', (...roles: TokenUser['role'][]): AuthHook => {
    return async (request, reply) => {
      try {
        // Lee "Authorization: Bearer <token>", comprueba firma y caducidad, y rellena request.user
        await request.jwtVerify();
      } catch {
        return reply.code(401).send({ message: 'No autorizado' });
      }
      // Token válido pero sin permisos: 403, no 401 (la sesión es buena, el rol no)
      if (!roles.includes(request.user.role)) {
        return reply.code(403).send({ message: 'No tienes permiso para esta acción' });
      }
    };
  });
});
