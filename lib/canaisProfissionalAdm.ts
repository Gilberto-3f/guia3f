import type { SupabaseClient } from '@supabase/supabase-js'
import { aplicarFiltroPaisMensagensCanal, type ModoFiltroPaisCanal } from '@/lib/canalAbasPaisColetivo'
import {
  CATEGORIAS_PROFISSIONAIS_SLUG,
  categoriaProfissionalParaSlug,
  isCanalAdmProfissionalGlobal,
  slugCanalComunidadeProfissional,
} from '@/lib/canaisProfissionalSlugs'

export type CanalAdmInboxConfig = {
  canalAdmId: string
  /** Canais globais de comunidade (Guias, Vans…) onde o ADM publica avisos. */
  canaisBroadcastIds: string[]
  categoriasSlugs: string[]
}

/**
 * Categorias (slugs) do profissional autenticado.
 */
export async function buscarCategoriasSlugsProfissional(
  supabase: SupabaseClient,
  usuarioId: string
): Promise<string[]> {
  const { data } = await supabase.from('profissionais').select('categorias').eq('usuario_id', usuarioId).maybeSingle()
  const cats = Array.isArray(data?.categorias) ? data.categorias.map(String) : []
  const slugs = [...new Set(cats.map((c) => categoriaProfissionalParaSlug(c)).filter(Boolean))]
  return slugs.filter((s) => (CATEGORIAS_PROFISSIONAIS_SLUG as readonly string[]).includes(s))
}

/**
 * Resolve inbox do Canal ADM: canal global ADM + canais de broadcast das comunidades do profissional.
 */
export async function resolverInboxCanalAdmProfissional(
  supabase: SupabaseClient,
  usuarioId: string,
  canalAdmId: string
): Promise<CanalAdmInboxConfig> {
  const categoriasSlugs = await buscarCategoriasSlugsProfissional(supabase, usuarioId)

  let q = supabase
    .from('canais')
    .select('id, nome, categoria, tipo_publico, empresa_id, ativo')
    .eq('tipo_publico', 'profissional')
    .eq('ativo', true)
    .is('empresa_id', null)

  if (categoriasSlugs.length > 0) {
    q = q.in('categoria', categoriasSlugs)
  }

  const { data: canais } = await q

  const canaisBroadcastIds: string[] = []
  for (const c of canais ?? []) {
    if (isCanalAdmProfissionalGlobal(c)) continue
    const slug = slugCanalComunidadeProfissional(
      c.categoria != null ? String(c.categoria) : null,
      c.nome != null ? String(c.nome) : null
    )
    if (!slug || !categoriasSlugs.includes(slug)) continue
    canaisBroadcastIds.push(String(c.id))
  }

  return {
    canalAdmId,
    canaisBroadcastIds,
    categoriasSlugs,
  }
}

export type MensagemCanalRow = {
  id: string
  canal_id: string
  remetente_id: string
  texto: string | null
  anexo_url: string | null
  anexo_tipo: string | null
  reacoes: unknown
  created_at: string
  pais: string | null
}

/**
 * Mensagens visíveis no Canal ADM do profissional:
 * - Canal ADM global (avisos gerais de admin)
 * - Canais de comunidade (só mensagens enviadas por usuários admin)
 */
export async function listarMensagensInboxCanalAdm(
  supabase: SupabaseClient,
  inbox: CanalAdmInboxConfig,
  opts?: { paisTab?: string; limit?: number; modoFiltroPais?: ModoFiltroPaisCanal }
): Promise<MensagemCanalRow[]> {
  const ids = [inbox.canalAdmId, ...inbox.canaisBroadcastIds].filter(Boolean)
  if (ids.length === 0) return []

  const paisTab = opts?.paisTab ?? 'geral'
  const limit = opts?.limit ?? 120
  const modo = opts?.modoFiltroPais ?? 'leitura_publico'

  let q = supabase.from('mensagens_canal').select('*').in('canal_id', ids)

  q = aplicarFiltroPaisMensagensCanal(q, paisTab, modo)

  const { data, error } = await q.order('created_at', { ascending: false }).limit(limit)
  if (error) throw error

  const rows = (data ?? []) as MensagemCanalRow[]
  if (rows.length === 0) return []

  const remetenteIds = [...new Set(rows.map((r) => r.remetente_id).filter(Boolean))]
  const { data: usuarios } = await supabase.from('usuarios').select('id, role').in('id', remetenteIds)
  const rolePorId = new Map((usuarios ?? []).map((u) => [String(u.id), String(u.role ?? '')]))

  const broadcastSet = new Set(inbox.canaisBroadcastIds)

  const filtradas = rows.filter((m) => {
    if (m.canal_id === inbox.canalAdmId) {
      const role = rolePorId.get(m.remetente_id) ?? ''
      return role === 'admin'
    }
    if (broadcastSet.has(m.canal_id)) {
      return rolePorId.get(m.remetente_id) === 'admin'
    }
    return false
  })

  return filtradas.sort(
    (a, b) => new Date(String(a.created_at ?? 0)).getTime() - new Date(String(b.created_at ?? 0)).getTime(),
  )
}
