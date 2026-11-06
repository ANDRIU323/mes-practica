import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { hashPassword, verifyPassword } from '../../plugins/auth.js';
import { HttpError } from '../orders/worklogs.js';
import { changePasswordBody, employeeLoginBody, loginBody, publicUserSelect } from './auth.schema.js';
import { clearFailedLogins, isLocked, lockedBody, registerFailedLogin } from './loginLock.js';

const INVALID_CREDENTIALS = { message: 'Email o contraseña incorrectos' };
const INVALID_EMPLOYEE_CREDENTIALS = { message: 'Código o PIN incorrectos' };
const ADMIN_LOCKED = 'Demasiados intentos fallidos: cuenta bloqueada durante 1 hora';
const EMPLOYEE_LOCKED = 'Demasiados intentos fallidos: pide al administrador un PIN nuevo o espera 1 hora';

const authRoutes: FastifyPluginAsyncZod = async (app) => {
  // Si el email no existe se compara contra este hash igualmente, para que la
  // respuesta tarde lo mismo y no delate qué emails están registrados
  const dummyHash = await hashPassword('dummy-password');

  // POST /api/auth/login
  app.post('/login', { schema: { body: loginBody } }, async (req, reply) => {
    const { email, password } = req.body;
    const user = await app.db.user.findUnique({ where: { email } });

    // Bloqueada: ni se comprueba la contraseña, para no servir de oráculo
    if (user && isLocked(user)) {
      return reply.code(423).send(lockedBody(user.lockedUntil!, ADMIN_LOCKED));
    }

    const valid = await verifyPassword(password, user?.passwordHash ?? dummyHash);
    if (user && !valid) {
      const { lockedUntil } = await registerFailedLogin(app.db, { table: 'User', id: user.id });
      if (lockedUntil) return reply.code(423).send(lockedBody(lockedUntil, ADMIN_LOCKED));
    }
    if (!user || !valid || user.role !== 'ADMIN') {
      return reply.code(401).send(INVALID_CREDENTIALS);
    }
    await clearFailedLogins(app.db, { table: 'User', id: user.id }, user);

    const token = app.jwt.sign({ sub: user.id, role: 'ADMIN' });
    return {
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    };
  });

  // POST /api/auth/employee-login
  // Un PIN de 4 dígitos se adivina probando: máximo 5 intentos por minuto y por IP
  const employeeLoginLimit = { rateLimit: { max: 5, timeWindow: '1 minute' } };
  app.post('/employee-login', { schema: { body: employeeLoginBody }, config: employeeLoginLimit }, async (req, reply) => {
    const { code, pin } = req.body;
    const employee = await app.db.employee.findUnique({ where: { code }, omit: { pinHash: false } });

    if (employee && isLocked(employee)) {
      return reply.code(423).send(lockedBody(employee.lockedUntil!, EMPLOYEE_LOCKED));
    }

    // Misma respuesta para código inexistente, sin PIN, inactivo o PIN erróneo
    const valid = await verifyPassword(pin, employee?.pinHash ?? dummyHash);
    if (employee && !valid) {
      const { lockedUntil } = await registerFailedLogin(app.db, { table: 'Employee', id: employee.id });
      if (lockedUntil) return reply.code(423).send(lockedBody(lockedUntil, EMPLOYEE_LOCKED));
    }
    if (!employee || !employee.pinHash || !employee.active || !valid) {
      return reply.code(401).send(INVALID_EMPLOYEE_CREDENTIALS);
    }
    await clearFailedLogins(app.db, { table: 'Employee', id: employee.id }, employee);

    const token = app.jwt.sign({ role: 'EMPLOYEE', employeeId: employee.id });
    return {
      token,
      user: { id: employee.id, code: employee.code, name: employee.name, role: 'EMPLOYEE' as const },
    };
  });

  // POST /api/auth/password – el admin cambia su contraseña. Fallar la actual cuenta
  // como intento fallido: con un token robado tampoco se puede probar sin límite
  app.post(
    '/password',
    { preHandler: app.requireRole('ADMIN'), schema: { body: changePasswordBody } },
    async (req, reply) => {
      if (req.user.role !== 'ADMIN') throw new HttpError(403, 'No tienes permiso para esta acción');
      const { currentPassword, newPassword } = req.body;
      const user = await app.db.user.findUnique({ where: { id: req.user.sub } });
      if (!user) return reply.code(401).send({ message: 'No autorizado' });

      if (isLocked(user)) return reply.code(423).send(lockedBody(user.lockedUntil!, ADMIN_LOCKED));
      if (!(await verifyPassword(currentPassword, user.passwordHash))) {
        const { lockedUntil } = await registerFailedLogin(app.db, { table: 'User', id: user.id });
        if (lockedUntil) return reply.code(423).send(lockedBody(lockedUntil, ADMIN_LOCKED));
        // 400 y no 401: el frontend cierra la sesión con cualquier 401
        return reply.code(400).send({ message: 'La contraseña actual no es correcta' });
      }

      await app.db.user.update({
        where: { id: user.id },
        data: {
          passwordHash: await hashPassword(newPassword),
          failedLoginAttempts: 0,
          firstFailedLoginAt: null,
          lockedUntil: null,
        },
      });
      return reply.code(204).send();
    },
  );

  // GET /api/auth/me
  app.get('/me', { preHandler: app.requireRole('ADMIN', 'EMPLOYEE') }, async (req, reply) => {
    if (req.user.role === 'EMPLOYEE') {
      const employee = await app.db.employee.findUnique({
        where: { id: req.user.employeeId },
        select: { id: true, code: true, name: true, active: true },
      });
      // Desactivado después de entrar: la sesión deja de valer
      if (!employee?.active) return reply.code(401).send({ message: 'No autorizado' });
      return { id: employee.id, code: employee.code, name: employee.name, role: 'EMPLOYEE' as const };
    }

    const user = await app.db.user.findUnique({
      where: { id: req.user.sub },
      select: publicUserSelect,
    });
    // El token puede ser válido aunque el usuario se haya borrado después
    if (!user) return reply.code(401).send({ message: 'No autorizado' });
    return user;
  });
};

export default authRoutes;
