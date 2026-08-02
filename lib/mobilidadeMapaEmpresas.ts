import {
  aplicarFiltroEmpresasGuiaPublico,
} from '@/lib/empresaGuiaVisibilidade'
import {
  CATEGORIA_DB_PARA_SLUG,
  CIDADE_POR_PAIS_GUIA,
  aliasesCidadeGuia,
  type PaisGuiaFiltro,
  type SegmentoEmpresaSlug,
  categoriaDbParaSlug,
} from '@/lib/segmentosEmpresaGuia'

/** Colunas mínimas para pin + card do mapa + autocomplete. */
const COLUNAS_MAPA =
  'id, nome_fantasia, nome_usuario, categoria, cidade, endereco, latitude, longitude, foto_url, nota_media, plano, somente_anfitriao'

/** Limite alinhado aos pins HTML no cliente (evita scan de 400 linhas). */
const LIMITE_MAPA = 120

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
    descricao_curta: null,
    categoria,
    cidade: String(row.cidade ?? ''),
    endereco: row.endereco != null && String(row.endereco).trim() ? String(row.endereco).trim() : null,
    bairro: null,
    status: null,
    docs_verificado: null,
    nota_media: row.nota_media != null ? Number(row.nota_media) : null,
    total_avaliacoes: null,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    foto_url: row.foto_url != null ? String(row.foto_url) : null,
    whatsapp: null,
    preco_ticket_inteira: null,
    preco_ticket_meia: null,
    preco_diaria: null,
    plano: row.plano != null ? String(row.plano) : null,
    somente_anfitriao: row.somente_anfitriao == null ? null : Boolean(row.somente_anfitriao),
    segmento: categoriaDbParaSlug(categoria) || (CATEGORIA_DB_PARA_SLUG[categoria] as SegmentoEmpresaSlug) || '',
  }
}

/**
 * Uma query leve (service role). Sem retry em timeout — retry piora cascata 57014.
 */
export async function buscarEmpresasMapaMobilidade(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<{ lista: EmpresaMapaMobilidade[]; error: string | null }> {
  const run = async (comPreview: boolean) => {
    const q = aplicarFiltroEmpresasGuiaPublico(
      supabase
        .from('empresas')
        .select(COLUNAS_MAPA)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null),
      { comPreviewFilter: comPreview },
    )
    return q.order('nota_media', { ascending: false }).limit(LIMITE_MAPA)
  }

  let res = await run(true)
  const previewMsg = String(res.error?.message ?? '').toLowerCase()
  if (previewMsg.includes('somente_modo_apresentacao')) {
    res = await run(false)
  }

  if (res.error) {
    return { lista: [], error: String(res.error.message ?? 'Falha ao carregar atrativos do mapa.') }
  }

  const byId = new Map<string, EmpresaMapaMobilidade>()
  for (const row of (res.data ?? []) as Record<string, unknown>[]) {
    const mapped = mapRow(row)
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
