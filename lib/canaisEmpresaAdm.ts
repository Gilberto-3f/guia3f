import type { SupabaseClient } from '@supabase/supabase-js'
import { aplicarFiltroPaisMensagensCanal, type ModoFiltroPaisCanal } from '@/lib/canalAbasPaisColetivo'
import {
  SEGMENTOS_EMPRESA_SLUG,
  categoriaEmpresaParaSlug,
  isCanalAdmEmpresaGlobal,
  isCanalFinanceiroEmpresa,
  slugCanalSegmentoEmpresa,
} from '@/lib/canaisEmpresaSlugs'
import { filtrarCanaisDoBloco } from '@/lib/canaisEcossistema'
import {
  filtrarCanaisGlobaisDosBlocos,
  resolverIdsBlocosCanaisEmpresa,
} from '@/lib/canaisEcossistemaPerfil'

export type CanalAdmEmpresaInboxConfig = {
  canalAdmId: string
  /** Canais globais de segmento (Gastronomia, Lojas…) onde o ADM publica avisos. */
  canaisBroadcastIds: string[]
  segmentosSlugs: string[]
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

type CanalEmpresaGlobalOpts = {
  ecossistemaId?: string | null
  usuarioId?: string | null
}

async function globaisEmpresaVisiveis(
  supabase: SupabaseClient,
  opts?: CanalEmpresaGlobalOpts,
) {
  const { data } = await supabase
    .from('canais')
    .select('id, nome, tipo_publico, empresa_id, ativo, categoria, ecossistema_id')
    .eq('tipo_publico', 'empresa')
    .eq('ativo', true)
    .is('empresa_id', null)

  const eco = opts?.ecossistemaId != null ? String(opts.ecossistemaId).trim() : ''
  if (eco) return filtrarCanaisDoBloco(data ?? [], eco)
  if (opts?.usuarioId) {
    const blocoIds = await resolverIdsBlocosCanaisEmpresa(supabase, opts.usuarioId)
    return filtrarCanaisGlobaisDosBlocos(data ?? [], blocoIds)
  }
  const blocoIds = await resolverIdsBlocosCanaisEmpresa(supabase, '')
  return filtrarCanaisGlobaisDosBlocos(data ?? [], blocoIds)
}

/** ID do canal global Financeiro pessoal (tipo empresa, pasta Administração). */
export async function buscarIdCanalFinanceiroEmpresaGlobal(
  supabase: SupabaseClient,
  opts?: CanalEmpresaGlobalOpts,
): Promise<string | null> {
  const visiveis = await globaisEmpresaVisiveis(supabase, opts)
  for (const c of visiveis) {
    if (isCanalFinanceiroEmpresa(c.nome != null ? String(c.nome) : null)) return String(c.id)
  }
  return null
}

/** ID do canal global ADM (tipo empresa). */
export async function buscarIdCanalAdmEmpresaGlobal(
  supabase: SupabaseClient,
  opts?: CanalEmpresaGlobalOpts,
): Promise<string | null> {
  const visiveis = await globaisEmpresaVisiveis(supabase, opts)
  for (const c of visiveis) {
    if (isCanalAdmEmpresaGlobal(c)) return String(c.id)
  }
  return null
}

/**
 * Segmento (slug) da empresa autenticada.
 */
export async function buscarSegmentoSlugEmpresa(
  supabase: SupabaseClient,
  usuarioId: string
): Promise<string[]> {
  const { data } = await supabase.from('empresas').select('categoria').eq('usuario_id', usuarioId).maybeSingle()
  const slug = categoriaEmpresaParaSlug(data?.categoria != null ? String(data.categoria) : null)
  if (!slug || !(SEGMENTOS_EMPRESA_SLUG as readonly string[]).includes(slug)) return []
  return [slug]
}

/**
 * Inbox do Canal ADM da empresa: canal ADM global + broadcast do segmento da empresa.
 */
export async function resolverInboxCanalAdmEmpresa(
  supabase: SupabaseClient,
  usuarioId: string,
  canalAdmId: string
): Promise<CanalAdmEmpresaInboxConfig> {
  const segmentosSlugs = await buscarSegmentoSlugEmpresa(supabase, usuarioId)

  const { data: canais } = await supabase
    .from('canais')
    .select('id, nome, categoria, tipo_publico, empresa_id, ativo, ecossistema_id')
    .eq('tipo_publico', 'empresa')
    .eq('ativo', true)
    .is('empresa_id', null)

  const { data: admRow } = await supabase
    .from('canais')
    .select('ecossistema_id')
    .eq('id', canalAdmId)
    .maybeSingle()
  const ecoAberto = admRow?.ecossistema_id != null ? String(admRow.ecossistema_id).trim() : ''
  const visiveis = ecoAberto
    ? filtrarCanaisDoBloco(canais ?? [], ecoAberto)
    : filtrarCanaisGlobaisDosBlocos(
        canais ?? [],
        await resolverIdsBlocosCanaisEmpresa(supabase, usuarioId),
      )
  const canaisBroadcastIds: string[] = []
  for (const c of visiveis) {
    if (isCanalAdmEmpresaGlobal(c)) continue
    const n = String(c.nome ?? '').trim().toUpperCase()
    if (n === 'FINANCEIRO') continue
    const slug = slugCanalSegmentoEmpresa(
      c.categoria != null ? String(c.categoria) : null,
      c.nome != null ? String(c.nome) : null
    )
    if (!slug || !segmentosSlugs.includes(slug)) continue
    canaisBroadcastIds.push(String(c.id))
  }

  return {
    canalAdmId,
    canaisBroadcastIds,
    segmentosSlugs,
  }
}

/**
 * Mensagens no Canal ADM da empresa: avisos gerais + segmento (somente remetente admin).
 */
export async function listarMensagensInboxCanalAdmEmpresa(
  supabase: SupabaseClient,
  inbox: CanalAdmEmpresaInboxConfig,
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
    const role = rolePorId.get(m.remetente_id) ?? ''
    if (role !== 'admin') return false
    if (m.canal_id === inbox.canalAdmId) return true
    return broadcastSet.has(m.canal_id)
  })

  return filtradas.sort(
    (a, b) => new Date(String(a.created_at ?? 0)).getTime() - new Date(String(b.created_at ?? 0)).getTime(),
  )
}
