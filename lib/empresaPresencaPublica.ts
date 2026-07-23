/**
 * Presença pública no guia/feed/atividades: assinatura vigente, degustação ativa ou anfitrião.
 * Ciclo vencido sem renovação → fora da listagem para turista/profissional.
 *
 * Cache + inflight dedupe: feed/stories/atividades chamam várias vezes por navegação;
 * sem isso o pool do Postgres satura para TODOS os perfis.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { assinaturaContratadaVigente } from '@/lib/empresaAssinatura'

const PRESENCA_CACHE_MS = 60_000

type PresencaIdsCache = {
  at: number
  empIds: string[]
  usuarioIds: string[]
}

let presencaCache: PresencaIdsCache | null = null
/** @type {Promise<PresencaIdsCache> | null} */
let presencaInflight: Promise<PresencaIdsCache> | null = null

function agoraIso(d = new Date()): string {
  return d.toISOString()
}

/**
 * Assinaturas ativas ainda no ciclo (filtro no SQL — não traz vencidas com status='ativo').
 */
function queryAssinaturasVigentes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  iso: string,
) {
  return supabase
    .from('empresa_assinaturas')
    .select('empresa_id, status, vencimento_em')
    .eq('status', 'ativo')
    .or(`vencimento_em.is.null,vencimento_em.gte.${iso}`)
}

async function carregarPresencaPublicaRaw(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient | any,
  agora = new Date(),
): Promise<PresencaIdsCache> {
  const iso = agoraIso(agora)
  const [{ data: degRows, error: degErr }, { data: assRows, error: assErr }, { data: anfRows, error: anfErr }] =
    await Promise.all([
      supabase
        .from('empresa_degustacoes')
        .select('empresa_id')
        .eq('status', 'ativa')
        .gt('expira_em', iso),
      queryAssinaturasVigentes(supabase, iso),
      supabase
        .from('empresas')
        .select('id')
        .eq('somente_anfitriao', true)
        .eq('docs_verificado', true)
        .in('status', ['aprovado', 'ativo'])
        .eq('somente_modo_apresentacao', false)
        .not('foto_url', 'is', null),
    ])

  if (degErr || assErr || anfErr) {
    console.warn('[empresaPresencaPublica] falha parcial:', degErr?.message ?? assErr?.message ?? anfErr?.message)
    // Fail-soft: se já havia cache, devolve; senão conjunto vazio (não trava o feed).
    if (presencaCache) return presencaCache
    return { at: Date.now(), empIds: [], usuarioIds: [] }
  }

  const empSet = new Set<string>()
  for (const r of degRows ?? []) {
    if (r?.empresa_id != null) empSet.add(String(r.empresa_id))
  }
  for (const r of assRows ?? []) {
    // Dupla checagem cliente (calendário) — SQL já filtrou a maioria.
    if (assinaturaContratadaVigente(r, agora) && r?.empresa_id != null) {
      empSet.add(String(r.empresa_id))
    }
  }
  for (const r of anfRows ?? []) {
    if (r?.id != null) empSet.add(String(r.id))
  }

  const empIds = [...empSet]
  if (empIds.length === 0) {
    return { at: Date.now(), empIds: [], usuarioIds: [] }
  }

  // Chunk .in() para evitar URL/payload enorme.
  const usuarioIds: string[] = []
  const seenUid = new Set<string>()
  const CHUNK = 80
  for (let i = 0; i < empIds.length; i += CHUNK) {
    const slice = empIds.slice(i, i + CHUNK)
    const { data, error } = await supabase.from('empresas').select('usuario_id').in('id', slice)
    if (error) {
      console.warn('[empresaPresencaPublica] usuario_id chunk:', error.message)
      if (presencaCache) return presencaCache
      break
    }
    for (const row of (data ?? []) as { usuario_id?: unknown }[]) {
      const uid = row.usuario_id != null ? String(row.usuario_id).trim() : ''
      if (!uid || seenUid.has(uid)) continue
      seenUid.add(uid)
      usuarioIds.push(uid)
    }
  }

  return { at: Date.now(), empIds, usuarioIds }
}

async function obterPresencaCache(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient | any,
  agora = new Date(),
): Promise<PresencaIdsCache> {
  const now = Date.now()
  if (presencaCache && now - presencaCache.at < PRESENCA_CACHE_MS) {
    return presencaCache
  }
  if (presencaInflight) return presencaInflight

  presencaInflight = (async () => {
    try {
      const next = await carregarPresencaPublicaRaw(supabase, agora)
      // Só grava cache “bom”; se vazio por erro e havia cache antigo, mantém o antigo.
      if (next.empIds.length > 0 || !presencaCache) {
        presencaCache = next
      } else if (presencaCache && now - presencaCache.at < PRESENCA_CACHE_MS * 3) {
        return presencaCache
      } else {
        presencaCache = next
      }
      return presencaCache
    } catch (err) {
      console.warn('[empresaPresencaPublica] exception:', err)
      if (presencaCache) return presencaCache
      return { at: Date.now(), empIds: [], usuarioIds: [] }
    } finally {
      presencaInflight = null
    }
  })()

  return presencaInflight
}

/** IDs de `empresas` com direito a aparecer no guia/feed (não inclui modo apresentação). */
export async function buscarIdsEmpresaPresencaPublicaVigente(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient | any,
  agora = new Date(),
): Promise<Set<string>> {
  const c = await obterPresencaCache(supabase, agora)
  return new Set(c.empIds)
}

/** `usuario_id` (gestor) das empresas com presença pública vigente. */
export async function buscarUsuarioIdsEmpresaPresencaPublicaVigente(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient | any,
): Promise<string[]> {
  const c = await obterPresencaCache(supabase)
  return c.usuarioIds.slice()
}

/**
 * Empresa individual: tem presença pública? (para gate de página / favoritos).
 * Anfitrião, degustação ativa ou assinatura vigente.
 */
export async function empresaTemPresencaPublicaVigente(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient | any,
  empresaId: string,
  opts?: { somenteAnfitriao?: boolean | null },
): Promise<boolean> {
  if (!empresaId) return false
  if (opts?.somenteAnfitriao === true) return true

  // Sempre via cache global (60s + inflight): evita 2 round-trips por página.
  const cached = await obterPresencaCache(supabase)
  return cached.empIds.includes(empresaId)
}

/**
 * Empresa do gestor `usuarioId` tem presença pública vigente?
 * Cache curto para BottomBar / badges (evita N queries no boot).
 */
const vigenciaPorUsuarioCache = {
  userId: '',
  at: 0,
  vigente: false,
}

const VIGENCIA_CACHE_MS = 60_000

export async function empresaGestorTemPresencaVigenteCached(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient | any,
  usuarioId: string,
): Promise<boolean> {
  if (!usuarioId) return false
  const agora = Date.now()
  if (
    vigenciaPorUsuarioCache.userId === usuarioId &&
    agora - vigenciaPorUsuarioCache.at < VIGENCIA_CACHE_MS
  ) {
    return vigenciaPorUsuarioCache.vigente
  }

  try {
    // Preferir cache global de gestores vigentes (1 fetch para o app inteiro).
    const c = await obterPresencaCache(supabase)
    if (c.usuarioIds.length > 0 || c.empIds.length > 0) {
      const vigente = c.usuarioIds.includes(usuarioId)
      vigenciaPorUsuarioCache.userId = usuarioId
      vigenciaPorUsuarioCache.at = agora
      vigenciaPorUsuarioCache.vigente = vigente
      return vigente
    }

    const { data: emp } = await supabase
      .from('empresas')
      .select('id, somente_anfitriao')
      .eq('usuario_id', usuarioId)
      .maybeSingle()

    if (!emp?.id) {
      vigenciaPorUsuarioCache.userId = usuarioId
      vigenciaPorUsuarioCache.at = agora
      vigenciaPorUsuarioCache.vigente = false
      return false
    }

    const vigente = await empresaTemPresencaPublicaVigente(supabase, String(emp.id), {
      somenteAnfitriao: Boolean(emp.somente_anfitriao),
    })
    vigenciaPorUsuarioCache.userId = usuarioId
    vigenciaPorUsuarioCache.at = agora
    vigenciaPorUsuarioCache.vigente = vigente
    return vigente
  } catch (err) {
    console.warn('[empresaPresencaPublica] gestor cached:', err)
    return false
  }
}

export function invalidarCachePresencaVigenteEmpresa(userId?: string | null) {
  if (!userId || vigenciaPorUsuarioCache.userId === userId) {
    vigenciaPorUsuarioCache.userId = ''
    vigenciaPorUsuarioCache.at = 0
    vigenciaPorUsuarioCache.vigente = false
  }
  // Invalida allowlist global (após renovação de plano, etc.).
  if (!userId) {
    presencaCache = null
    presencaInflight = null
  }
}

/** Força limpar allowlist (ex.: evento perfil-atualizado / empresa-gate-refresh). */
export function invalidarCachePresencaPublicaGlobal() {
  presencaCache = null
  presencaInflight = null
  vigenciaPorUsuarioCache.userId = ''
  vigenciaPorUsuarioCache.at = 0
  vigenciaPorUsuarioCache.vigente = false
}
