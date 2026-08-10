/** Status de empresa elegível no guia turístico (verificadas / operacionais). */
import { aliasesCategoriaDbGuia, aliasesCidadeGuia } from '@/lib/segmentosEmpresaGuia'
import { buscarIdsEmpresaPresencaPublicaVigente } from '@/lib/empresaPresencaPublica'

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

/** Lista empresas do guia por categoria/cidade (mesma elegibilidade do mapa: presença pública vigente). */
export async function buscarEmpresasListagemGuia(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  opts: { categoria: string; cidade: string },
): Promise<{ lista: Record<string, unknown>[]; error: string | null }> {
  const { categoria, cidade } = opts
  const categorias = aliasesCategoriaDbGuia(categoria)
  const cidades = aliasesCidadeGuia(cidade)

  if (categorias.length === 0 || cidades.length === 0) {
    return { lista: [], error: null }
  }

  const idsSet = await buscarIdsEmpresaPresencaPublicaVigente(supabase)
  const ids = [...idsSet]
  if (ids.length === 0) {
    return { lista: [], error: null }
  }

  const base = (select: string, slice: string[]) =>
    supabase
      .from('empresas')
      .select(select)
      .in('id', slice)
      .in('categoria', categorias)
      .in('cidade', cidades)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ordenar = (q: any) =>
    q.order('nota_media', { ascending: false }).order('total_avaliacoes', { ascending: false })

  async function queryChunk(select: string, slice: string[], comPreview: boolean) {
    return ordenar(
      aplicarFiltroEmpresasGuiaPlanoOuDegustacao(base(select, slice), {
        comPreviewFilter: comPreview,
      }),
    )
  }

  const CHUNK = 80
  let select = COLUNAS_EMPRESA_GUIA
  const byId = new Map<string, Record<string, unknown>>()

  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK)

    let res = await queryChunk(select, slice, true)
    const msg = String(res.error?.message ?? '').toLowerCase()
    if (msg.includes('palavras_chave') && (msg.includes('column') || msg.includes('does not exist'))) {
      select = COLUNAS_EMPRESA_GUIA_SEM_PALAVRAS
      res = await queryChunk(select, slice, true)
    }
    const previewMsg = String(res.error?.message ?? '').toLowerCase()
    if (previewMsg.includes('somente_modo_apresentacao')) {
      res = await queryChunk(select, slice, false)
    }

    if (res.error) {
      return { lista: [], error: String(res.error.message) }
    }

    for (const row of res.data ?? []) {
      const id = String((row as { id: unknown }).id ?? '')
      if (id) byId.set(id, row as Record<string, unknown>)
    }
  }

  const lista = [...byId.values()].sort((a, b) => {
    const na = Number(a.nota_media) || 0
    const nb = Number(b.nota_media) || 0
    if (nb !== na) return nb - na
    return (Number(b.total_avaliacoes) || 0) - (Number(a.total_avaliacoes) || 0)
  })

  return { lista, error: null }
}
