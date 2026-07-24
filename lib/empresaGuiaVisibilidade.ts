/** Status de empresa elegível no guia turístico (verificadas / operacionais). */
import { aliasesCategoriaDbGuia, aliasesCidadeGuia } from '@/lib/segmentosEmpresaGuia'
import {
  assinaturaContratadaVigente,
  buscarAssinaturasPresencaPublica,
} from '@/lib/empresaAssinatura'

export const STATUS_EMPRESA_GUIA_PUBLICO = ['aprovado', 'ativo'] as const

export type EmpresaLinhaGuia = {
  status?: string | null
  docs_verificado?: boolean | null
  foto_url?: string | null
  somente_modo_apresentacao?: boolean | null
}

/** Critério de exibição no guia: documentação conferida + status liberado + foto de perfil. */
export function empresaElegivelGuiaPublico(row: EmpresaLinhaGuia | null | undefined): boolean {
  if (!row) return false
  if (row.somente_modo_apresentacao === true) return false
  if (row.docs_verificado !== true) return false
  const status = String(row.status ?? '').toLowerCase()
  if (!STATUS_EMPRESA_GUIA_PUBLICO.includes(status as (typeof STATUS_EMPRESA_GUIA_PUBLICO)[number])) {
    return false
  }
  const foto = String(row.foto_url ?? '').trim()
  return foto.length > 0
}

/**
 * Aplica filtros padrão do guia em uma query Supabase de `empresas`.
 * Inclui empresas em degustação verificadas (mesmo critério de assinante regular).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function aplicarFiltroEmpresasGuiaPublico(query: any, opts?: { comPreviewFilter?: boolean }): any {
  const comPreview = opts?.comPreviewFilter !== false
  let q = query
    .eq('docs_verificado', true)
    .in('status', [...STATUS_EMPRESA_GUIA_PUBLICO])
    .not('foto_url', 'is', null)
  if (comPreview) {
    q = q.eq('somente_modo_apresentacao', false)
  }
  return q
}

/** Plano/degustação ativos: card no guia com foto (sem exigir docs_verificado). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function aplicarFiltroEmpresasGuiaPlanoOuDegustacao(query: any, opts?: { comPreviewFilter?: boolean }): any {
  const comPreview = opts?.comPreviewFilter !== false
  let q = query.not('foto_url', 'is', null)
  if (comPreview) {
    q = q.eq('somente_modo_apresentacao', false)
  }
  return q
}

const COLUNAS_EMPRESA_GUIA =
  'id, nome_fantasia, nome_usuario, descricao_curta, categoria, cidade, endereco, bairro, status, docs_verificado, nota_media, total_avaliacoes, latitude, longitude, foto_url, whatsapp, preco_ticket_inteira, preco_ticket_meia, preco_diaria, palavras_chave, plano, somente_anfitriao, hospedagem_disponibilidade'

const COLUNAS_EMPRESA_GUIA_SEM_PALAVRAS =
  'id, nome_fantasia, nome_usuario, descricao_curta, categoria, cidade, endereco, bairro, status, docs_verificado, nota_media, total_avaliacoes, latitude, longitude, foto_url, whatsapp, preco_ticket_inteira, preco_ticket_meia, preco_diaria, plano, somente_anfitriao, hospedagem_disponibilidade'

/** Lista empresas do guia por categoria/cidade, incluindo verificadas em degustação ativa. */
export async function buscarEmpresasListagemGuia(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  opts: { categoria: string; cidade: string },
): Promise<{ lista: Record<string, unknown>[]; error: string | null }> {
  const { categoria, cidade } = opts
  const agora = new Date().toISOString()
  const categorias = aliasesCategoriaDbGuia(categoria)
  const cidades = aliasesCidadeGuia(cidade)

  if (categorias.length === 0 || cidades.length === 0) {
    return { lista: [], error: null }
  }

  const [{ data: degRows }, assRows] = await Promise.all([
    supabase
      .from('empresa_degustacoes')
      .select('empresa_id')
      .eq('status', 'ativa')
      .gt('expira_em', agora),
    // RPC: turista/pro veem empresas com ciclo regular (RLS direto só libera dono/admin).
    buscarAssinaturasPresencaPublica(supabase),
  ])

  const degIds = [...new Set((degRows ?? []).map((r: { empresa_id: string }) => String(r.empresa_id)).filter(Boolean))]

  const assIds = [
    ...new Set(
      assRows
        .filter((r) => assinaturaContratadaVigente(r))
        .map((r) => r.empresa_id)
        .filter(Boolean),
    ),
  ]

  const base = (select: string) =>
    supabase.from('empresas').select(select).in('categoria', categorias).in('cidade', cidades)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ordenar = (q: any) =>
    q.order('nota_media', { ascending: false }).order('total_avaliacoes', { ascending: false })

  /** Anfitrião verificado — sem exigir assinatura paga. */
  async function queryAnfitriao(select: string, comPreview: boolean) {
    return ordenar(
      aplicarFiltroEmpresasGuiaPublico(base(select).eq('somente_anfitriao', true), {
        comPreviewFilter: comPreview,
      }),
    )
  }

  async function queryDegustacao(select: string, comPreview: boolean) {
    if (degIds.length === 0) return { data: [], error: null }
    return ordenar(
      aplicarFiltroEmpresasGuiaPlanoOuDegustacao(base(select).in('id', degIds), {
        comPreviewFilter: comPreview,
      }),
    )
  }

  async function queryAssinaturaAtiva(select: string, comPreview: boolean) {
    if (assIds.length === 0) return { data: [], error: null }
    return ordenar(
      aplicarFiltroEmpresasGuiaPlanoOuDegustacao(base(select).in('id', assIds), {
        comPreviewFilter: comPreview,
      }),
    )
  }

  let select = COLUNAS_EMPRESA_GUIA
  let anfRes = await queryAnfitriao(select, true)
  let degRes = await queryDegustacao(select, true)
  let assRes = await queryAssinaturaAtiva(select, true)

  const msg = String(anfRes.error?.message ?? '').toLowerCase()
  if (msg.includes('palavras_chave') && (msg.includes('column') || msg.includes('does not exist'))) {
    select = COLUNAS_EMPRESA_GUIA_SEM_PALAVRAS
    anfRes = await queryAnfitriao(select, true)
    degRes = await queryDegustacao(select, true)
    assRes = await queryAssinaturaAtiva(select, true)
  }

  const previewMsg = String(anfRes.error?.message ?? degRes.error?.message ?? assRes.error?.message ?? '').toLowerCase()
  if (previewMsg.includes('somente_modo_apresentacao')) {
    anfRes = await queryAnfitriao(select, false)
    degRes = await queryDegustacao(select, false)
    assRes = await queryAssinaturaAtiva(select, false)
  }

  if (anfRes.error) {
    return { lista: [], error: String(anfRes.error.message) }
  }

  const byId = new Map<string, Record<string, unknown>>()
  for (const row of [...(anfRes.data ?? []), ...(degRes.data ?? []), ...(assRes.data ?? [])]) {
    const id = String((row as { id: unknown }).id ?? '')
    if (id) byId.set(id, row as Record<string, unknown>)
  }

  return { lista: [...byId.values()], error: null }
}
