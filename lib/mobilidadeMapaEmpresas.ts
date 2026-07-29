import {
  aplicarFiltroEmpresasGuiaPlanoOuDegustacao,
  aplicarFiltroEmpresasGuiaPublico,
} from '@/lib/empresaGuiaVisibilidade'
import { buscarAssinaturasPresencaPublica, assinaturaContratadaVigente } from '@/lib/empresaAssinatura'
import {
  CATEGORIA_DB_PARA_SLUG,
  CIDADE_POR_PAIS_GUIA,
  aliasesCidadeGuia,
  type PaisGuiaFiltro,
  type SegmentoEmpresaSlug,
  categoriaDbParaSlug,
} from '@/lib/segmentosEmpresaGuia'

const COLUNAS =
  'id, nome_fantasia, nome_usuario, descricao_curta, categoria, cidade, endereco, bairro, status, docs_verificado, nota_media, total_avaliacoes, latitude, longitude, foto_url, whatsapp, preco_ticket_inteira, preco_ticket_meia, preco_diaria, palavras_chave, plano, somente_anfitriao, hospedagem_disponibilidade'

const COLUNAS_SEM_PALAVRAS =
  'id, nome_fantasia, nome_usuario, descricao_curta, categoria, cidade, endereco, bairro, status, docs_verificado, nota_media, total_avaliacoes, latitude, longitude, foto_url, whatsapp, preco_ticket_inteira, preco_ticket_meia, preco_diaria, plano, somente_anfitriao, hospedagem_disponibilidade'

export type EmpresaMapaMobilidade = {
  id: string
  nome_fantasia: string
  nome_usuario: string | null
  descricao_curta: string | null
  categoria: string
  cidade: string
  endereco: string | null
  bairro: string | null
  status: string | null
  docs_verificado: boolean | null
  nota_media: number | null
  total_avaliacoes: number | null
  latitude: number
  longitude: number
  foto_url: string | null
  whatsapp: string | null
  preco_ticket_inteira: number | null
  preco_ticket_meia: number | null
  preco_diaria: number | null
  palavras_chave?: unknown
  plano?: string | null
  somente_anfitriao?: boolean | null
  segmento: SegmentoEmpresaSlug | ''
}

/** Cores dos pins por segmento do Guia. */
export const COR_PIN_SEGMENTO: Record<SegmentoEmpresaSlug, string> = {
  gastronomia: '#E67E22',
  passeios: '#0097b2',
  lojas: '#8E44AD',
  hospedagem: '#27AE60',
  servicos_locais: '#2980B9',
}

export const FILTRO_CIDADE_OPCOES: { pais: PaisGuiaFiltro; label: string; cidade: string }[] = [
  { pais: 'br', label: 'Foz', cidade: CIDADE_POR_PAIS_GUIA.br },
  { pais: 'py', label: 'CDE', cidade: CIDADE_POR_PAIS_GUIA.py },
  { pais: 'ar', label: 'Iguazu', cidade: CIDADE_POR_PAIS_GUIA.ar },
]

function temCoords(row: Record<string, unknown>): boolean {
  const lat = Number(row.latitude)
  const lng = Number(row.longitude)
  return Number.isFinite(lat) && Number.isFinite(lng)
}

function mapRow(row: Record<string, unknown>): EmpresaMapaMobilidade | null {
  if (!temCoords(row)) return null
  const id = String(row.id ?? '')
  if (!id) return null
  const categoria = String(row.categoria ?? '')
  return {
    id,
    nome_fantasia: String(row.nome_fantasia ?? ''),
    nome_usuario: row.nome_usuario != null ? String(row.nome_usuario) : null,
    descricao_curta: row.descricao_curta != null ? String(row.descricao_curta) : null,
    categoria,
    cidade: String(row.cidade ?? ''),
    endereco: row.endereco != null ? String(row.endereco) : null,
    bairro: row.bairro != null ? String(row.bairro) : null,
    status: row.status != null ? String(row.status) : null,
    docs_verificado: row.docs_verificado == null ? null : Boolean(row.docs_verificado),
    nota_media: row.nota_media != null ? Number(row.nota_media) : null,
    total_avaliacoes: row.total_avaliacoes != null ? Number(row.total_avaliacoes) : null,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    foto_url: row.foto_url != null ? String(row.foto_url) : null,
    whatsapp: row.whatsapp != null ? String(row.whatsapp) : null,
    preco_ticket_inteira: row.preco_ticket_inteira != null ? Number(row.preco_ticket_inteira) : null,
    preco_ticket_meia: row.preco_ticket_meia != null ? Number(row.preco_ticket_meia) : null,
    preco_diaria: row.preco_diaria != null ? Number(row.preco_diaria) : null,
    palavras_chave: row.palavras_chave,
    plano: row.plano != null ? String(row.plano) : null,
    somente_anfitriao: row.somente_anfitriao == null ? null : Boolean(row.somente_anfitriao),
    segmento: categoriaDbParaSlug(categoria) || (CATEGORIA_DB_PARA_SLUG[categoria] as SegmentoEmpresaSlug) || '',
  }
}

/** Empresas elegíveis do Guia com latitude/longitude para o mapa de mobilidade. */
export async function buscarEmpresasMapaMobilidade(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<{ lista: EmpresaMapaMobilidade[]; error: string | null }> {
  const agora = new Date().toISOString()
  const [{ data: degRows }, assRows] = await Promise.all([
    supabase
      .from('empresa_degustacoes')
      .select('empresa_id')
      .eq('status', 'ativa')
      .gt('expira_em', agora),
    buscarAssinaturasPresencaPublica(supabase),
  ])

  const degIds = [
    ...new Set((degRows ?? []).map((r: { empresa_id: string }) => String(r.empresa_id)).filter(Boolean)),
  ]
  const assIds = [
    ...new Set(
      assRows
        .filter((r) => assinaturaContratadaVigente(r))
        .map((r) => r.empresa_id)
        .filter(Boolean),
    ),
  ]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ordenar = (q: any) => q.order('nota_media', { ascending: false })

  async function queryAnfitriao(select: string, comPreview: boolean) {
    return ordenar(
      aplicarFiltroEmpresasGuiaPublico(
        supabase
          .from('empresas')
          .select(select)
          .eq('somente_anfitriao', true)
          .not('latitude', 'is', null)
          .not('longitude', 'is', null),
        { comPreviewFilter: comPreview },
      ),
    )
  }

  async function queryDegustacao(select: string, comPreview: boolean) {
    if (degIds.length === 0) return { data: [], error: null }
    return ordenar(
      aplicarFiltroEmpresasGuiaPlanoOuDegustacao(
        supabase
          .from('empresas')
          .select(select)
          .in('id', degIds)
          .not('latitude', 'is', null)
          .not('longitude', 'is', null),
        { comPreviewFilter: comPreview },
      ),
    )
  }

  async function queryAssinatura(select: string, comPreview: boolean) {
    if (assIds.length === 0) return { data: [], error: null }
    return ordenar(
      aplicarFiltroEmpresasGuiaPlanoOuDegustacao(
        supabase
          .from('empresas')
          .select(select)
          .in('id', assIds)
          .not('latitude', 'is', null)
          .not('longitude', 'is', null),
        { comPreviewFilter: comPreview },
      ),
    )
  }

  let select = COLUNAS
  let anfRes = await queryAnfitriao(select, true)
  let degRes = await queryDegustacao(select, true)
  let assRes = await queryAssinatura(select, true)

  const msg = String(anfRes.error?.message ?? '').toLowerCase()
  if (msg.includes('palavras_chave')) {
    select = COLUNAS_SEM_PALAVRAS
    anfRes = await queryAnfitriao(select, true)
    degRes = await queryDegustacao(select, true)
    assRes = await queryAssinatura(select, true)
  }

  const previewMsg = String(
    anfRes.error?.message ?? degRes.error?.message ?? assRes.error?.message ?? '',
  ).toLowerCase()
  if (previewMsg.includes('somente_modo_apresentacao')) {
    anfRes = await queryAnfitriao(select, false)
    degRes = await queryDegustacao(select, false)
    assRes = await queryAssinatura(select, false)
  }

  if (anfRes.error) {
    return { lista: [], error: String(anfRes.error.message) }
  }

  const byId = new Map<string, EmpresaMapaMobilidade>()
  for (const row of [...(anfRes.data ?? []), ...(degRes.data ?? []), ...(assRes.data ?? [])]) {
    const mapped = mapRow(row as Record<string, unknown>)
    if (mapped) byId.set(mapped.id, mapped)
  }

  return { lista: [...byId.values()], error: null }
}

export function filtrarEmpresasMapa(
  lista: EmpresaMapaMobilidade[],
  opts: {
    cidade: string | null
    segmentos: SegmentoEmpresaSlug[] | null
  },
): EmpresaMapaMobilidade[] {
  let out = lista
  if (opts.cidade) {
    const aliases = new Set(
      aliasesCidadeGuia(opts.cidade).map((c) =>
        c
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase(),
      ),
    )
    out = out.filter((e) => {
      const c = String(e.cidade ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
      return aliases.has(c) || [...aliases].some((a) => c.includes(a) || a.includes(c))
    })
  }
  if (opts.segmentos && opts.segmentos.length > 0) {
    const set = new Set(opts.segmentos)
    out = out.filter((e) => e.segmento && set.has(e.segmento))
  }
  return out
}
