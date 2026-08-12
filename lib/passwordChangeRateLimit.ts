const MAX_FAILURES = 5
const LOCK_MS = 15 * 60 * 1000

type LockEntry = {
  fails: number
  lockedUntil: number | null
}

declare global {
  var __pwdChangeLocks: Map<string, LockEntry> | undefined
}

function store(): Map<string, LockEntry> {
  if (!globalThis.__pwdChangeLocks) {
    globalThis.__pwdChangeLocks = new Map()
  }
  return globalThis.__pwdChangeLocks
}

function now(): number {
  return Date.now()
}

export type RateLimitStatus =
  | { blocked: false; remainingAttempts: number }
  | { blocked: true; retryAfterSec: number }

/** Verifica se o usuário está bloqueado por tentativas falhas. */
export function getPasswordChangeLockStatus(userId: string): RateLimitStatus {
  const entry = store().get(userId)
  if (!entry) {
    return { blocked: false, remainingAttempts: MAX_FAILURES }
  }
  if (entry.lockedUntil != null && entry.lockedUntil > now()) {
    return {
      blocked: true,
      retryAfterSec: Math.ceil((entry.lockedUntil - now()) / 1000),
    }
  }
  if (entry.lockedUntil != null && entry.lockedUntil <= now()) {
    store().set(userId, { fails: 0, lockedUntil: null })
    return { blocked: false, remainingAttempts: MAX_FAILURES }
  }
  return {
    blocked: false,
    remainingAttempts: Math.max(0, MAX_FAILURES - entry.fails),
  }
}

/** Registra falha de senha atual. Retorna status atualizado. */
export function recordPasswordChangeFailure(userId: string): RateLimitStatus {
  const current = store().get(userId) ?? { fails: 0, lockedUntil: null }
  if (current.lockedUntil != null && current.lockedUntil > now()) {
    return {
      blocked: true,
      retryAfterSec: Math.ceil((current.lockedUntil - now()) / 1000),
    }
  }

  const fails = (current.lockedUntil != null ? 0 : current.fails) + 1
  if (fails >= MAX_FAILURES) {
    const lockedUntil = now() + LOCK_MS
    store().set(userId, { fails, lockedUntil })
    return {
      blocked: true,
      retryAfterSec: Math.ceil(LOCK_MS / 1000),
    }
  }

  store().set(userId, { fails, lockedUntil: null })
  return {
    blocked: false,
    remainingAttempts: MAX_FAILURES - fails,
  }
}

/** Zera contador após troca bem-sucedida. */
export function clearPasswordChangeFailures(userId: string): void {
  store().delete(userId)
}

export const PASSWORD_CHANGE_MAX_FAILURES = MAX_FAILURES
export const PASSWORD_CHANGE_LOCK_MINUTES = 15
