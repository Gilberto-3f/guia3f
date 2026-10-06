import { cookies } from 'next/headers'

const MEM_TTL_MS = 5 * 60_000
const COOKIE_MAX_AGE = 60 * 60

const COOKIE_ROLE = 'g3f_role'
const COOKIE_PROF = 'g3f_pid'

const ROLES_APP = new Set(['turista', 'profissional', 'empresa', 'admin'])

type MemEntry = { value: string; at: number }

const memRole = new Map<string, MemEntry>()
const memProf = new Map<string, MemEntry>()

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: COOKIE_MAX_AGE,
}

function memGet(map: Map<string, MemEntry>, key: string): string | null {
  const hit = map.get(key)
  if (!hit || Date.now() - hit.at >= MEM_TTL_MS) return null
  return hit.value
}

function memSet(map: Map<string, MemEntry>, key: string, value: string) {
  map.set(key, { value, at: Date.now() })
}

function parsePar(raw: string, userId: string): string | null {
  const sep = raw.indexOf('|')
  if (sep < 1) return null
  const uid = raw.slice(0, sep)
  const val = raw.slice(sep + 1).trim()
  if (uid !== userId || !val) return null
  return val
}

async function lerCookiePar(nome: string, userId: string): Promise<string | null> {
  try {
    const store = await cookies()
    return parsePar(store.get(nome)?.value ?? '', userId)
  } catch {
    return null
  }
}

async function gravarCookiePar(nome: string, userId: string, valor: string): Promise<void> {
  try {
    const store = await cookies()
    store.set(nome, `${userId}|${valor}`, COOKIE_OPTS)
  } catch {
    /* set falha em alguns contextos de render */
  }
}

export function roleAppValida(role: string | null | undefined): string | null {
  const s = String(role ?? '').trim()
  return ROLES_APP.has(s) ? s : null
}

export async function lerRoleCache(userId: string): Promise<string | null> {
  const mem = memGet(memRole, userId)
  if (mem) return mem
  const cookie = await lerCookiePar(COOKIE_ROLE, userId)
  if (cookie && cookie !== 'authenticated') {
    memSet(memRole, userId, cookie)
    return cookie
  }
  return null
}

export async function gravarRoleCache(userId: string, role: string): Promise<void> {
  const ok = String(role ?? '').trim()
  if (!ok || ok === 'authenticated') return
  memSet(memRole, userId, ok)
  await gravarCookiePar(COOKIE_ROLE, userId, ok)
}

export async function lerProfissionalIdCache(userId: string): Promise<string | null> {
  const mem = memGet(memProf, userId)
  if (mem) return mem
  const cookie = await lerCookiePar(COOKIE_PROF, userId)
  if (cookie) {
    memSet(memProf, userId, cookie)
    return cookie
  }
  return null
}

export async function gravarProfissionalIdCache(userId: string, profissionalId: string): Promise<void> {
  const id = String(profissionalId ?? '').trim()
  if (!id) return
  memSet(memProf, userId, id)
  await gravarCookiePar(COOKIE_PROF, userId, id)
}

export async function limparPerfilSessaoCookies(): Promise<void> {
  try {
    const store = await cookies()
    store.set(COOKIE_ROLE, '', { ...COOKIE_OPTS, maxAge: 0 })
    store.set(COOKIE_PROF, '', { ...COOKIE_OPTS, maxAge: 0 })
  } catch {
    /* ignore */
  }
}
