/**
 * Presença pública no guia/feed/atividades: assinatura vigente, degustação ativa ou anfitrião.
 * Ciclo vencido sem renovação → fora da listagem para turista/profissional.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { assinaturaContratadaVigente } from '@/lib/empresaAssinatura'

/** IDs de `empresas` com direito a aparecer no guia/feed (não inclui modo apresentação). */
export async function buscarIdsEmpresaPresencaPublicaVigente(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient | any,
  agora = new Date(),
): Promise<Set<string>> {
  const agoraIso = agora.toISOString()
  const [{ data: degRows }, { data: assRows }, { data: anfRows }] = await Promise.all([
    supabase
      .from('empresa_degustacoes')
      .select('empresa_id')
      .eq('status', 'ativa')
      .gt('expira_em', agoraIso),
    supabase.from('empresa_assinaturas').select('empresa_id, status, vencimento_em').eq('status', 'ativo'),
    supabase
      .from('empresas')
      .select('id')
      .eq('somente_anfitriao', true)
      .eq('docs_verificado', true)
      .in('status', ['aprovado', 'ativo'])
      .eq('somente_modo_apresentacao', false)
      .not('foto_url', 'is', null),
  ])

  const ids = new Set<string>()
  for (const r of degRows ?? []) {
    if (r?.empresa_id != null) ids.add(String(r.empresa_id))
  }
  for (const r of assRows ?? []) {
    if (assinaturaContratadaVigente(r, agora) && r?.empresa_id != null) {
      ids.add(String(r.empresa_id))
    }
  }
  for (const r of anfRows ?? []) {
    if (r?.id != null) ids.add(String(r.id))
  }
  return ids
}

/** `usuario_id` (gestor) das empresas com presença pública vigente. */
export async function buscarUsuarioIdsEmpresaPresencaPublicaVigente(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient | any,
): Promise<string[]> {
  const empIds = await buscarIdsEmpresaPresencaPublicaVigente(supabase)
  if (empIds.size === 0) return []
  const ids = [...empIds]
  const { data, error } = await supabase.from('empresas').select('usuario_id').in('id', ids)
  if (error || !data?.length) return []
  return [
    ...new Set(
      data
        .map((r: { usuario_id?: unknown }) => (r.usuario_id != null ? String(r.usuario_id) : ''))
        .filter(Boolean),
    ),
  ]
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

  const agora = new Date().toISOString()
  const [{ data: deg }, { data: ass }] = await Promise.all([
    supabase
      .from('empresa_degustacoes')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('status', 'ativa')
      .gt('expira_em', agora)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('empresa_assinaturas')
      .select('status, vencimento_em')
      .eq('empresa_id', empresaId)
      .eq('status', 'ativo')
      .order('assinado_em', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (deg?.id) return true
  return assinaturaContratadaVigente(ass)
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
}

export function invalidarCachePresencaVigenteEmpresa(userId?: string | null) {
  if (!userId || vigenciaPorUsuarioCache.userId === userId) {
    vigenciaPorUsuarioCache.userId = ''
    vigenciaPorUsuarioCache.at = 0
    vigenciaPorUsuarioCache.vigente = false
  }
}
