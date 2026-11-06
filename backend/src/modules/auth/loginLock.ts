import { Prisma } from '@prisma/client';
import type { Db } from '../../plugins/prisma.js';

// Bloqueo de cuentas por intentos fallidos, guardado en la BD (vale aunque el
// atacante cambie de IP, al contrario que el rate limit). Sirve para User y Employee.

export const MAX_FAILED_LOGINS = 5;
// Ventana en la que se cuentan los fallos y duración del bloqueo
export const LOCK_WINDOW_MS = 60 * 60 * 1000;

export type LockState = {
  failedLoginAttempts: number;
  firstFailedLoginAt: Date | null;
  lockedUntil: Date | null;
};

export type LockAccount = { table: 'User' | 'Employee'; id: number };

export function isLocked(state: Pick<LockState, 'lockedUntil'>, now = new Date()) {
  return state.lockedUntil !== null && state.lockedUntil > now;
}

// Un fallo fuera de la ventana empieza la cuenta de cero; al llegar al máximo
// se bloquea y el contador vuelve a 0
export function stateAfterFailure(state: LockState, now: Date): LockState {
  const inWindow =
    state.firstFailedLoginAt !== null &&
    now.getTime() - state.firstFailedLoginAt.getTime() < LOCK_WINDOW_MS;
  const attempts = inWindow ? state.failedLoginAttempts + 1 : 1;

  if (attempts >= MAX_FAILED_LOGINS) {
    return {
      failedLoginAttempts: 0,
      firstFailedLoginAt: null,
      lockedUntil: new Date(now.getTime() + LOCK_WINDOW_MS),
    };
  }
  return {
    failedLoginAttempts: attempts,
    firstFailedLoginAt: inWindow ? state.firstFailedLoginAt : now,
    lockedUntil: null,
  };
}

function writeState(db: Pick<Db, '$executeRaw'>, account: LockAccount, state: LockState) {
  return db.$executeRaw`
    UPDATE ${Prisma.raw(`"${account.table}"`)}
    SET "failedLoginAttempts" = ${state.failedLoginAttempts},
        "firstFailedLoginAt" = ${state.firstFailedLoginAt},
        "lockedUntil" = ${state.lockedUntil}
    WHERE id = ${account.id}`;
}

// Devuelve el estado nuevo: si trae lockedUntil, este fallo ha bloqueado la cuenta
export function registerFailedLogin(db: Db, account: LockAccount, now = new Date()) {
  return db.$transaction(async (tx) => {
    // FOR UPDATE: dos fallos a la vez no pueden leer el mismo contador
    const [state] = await tx.$queryRaw<LockState[]>`
      SELECT "failedLoginAttempts", "firstFailedLoginAt", "lockedUntil"
      FROM ${Prisma.raw(`"${account.table}"`)}
      WHERE id = ${account.id}
      FOR UPDATE`;
    const next = stateAfterFailure(state, now);
    await writeState(tx, account, next);
    return next;
  });
}

// Tras un acierto. Solo escribe si hay algo que limpiar
export async function clearFailedLogins(db: Pick<Db, '$executeRaw'>, account: LockAccount, state: LockState) {
  if (state.failedLoginAttempts === 0 && state.lockedUntil === null) return;
  await writeState(db, account, { failedLoginAttempts: 0, firstFailedLoginAt: null, lockedUntil: null });
}

export function lockedBody(lockedUntil: Date, message: string) {
  return { message, lockedUntil: lockedUntil.toISOString() };
}
