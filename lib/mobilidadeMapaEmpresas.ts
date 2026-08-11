import {
  aplicarFiltroEmpresasGuiaPlanoOuDegustacao,
} from '@/lib/empresaGuiaVisibilidade'
import { buscarIdsEmpresaPresencaPublicaVigente } from '@/lib/empresaPresencaPublica'
import { backfillCoordsEmpresas } from '@/lib/empresaCoordsBackfill'
import {
  CATEGORIA_DB_PARA_SLUG,
  CIDADE_POR_PAIS_GUIA,
  aliasesCidadeGuia,
  type PaisGuiaFiltro,
  type SegmentoEmpresaSlug,
  categoriaDbParaSlug,
} from '@/lib/segmentosEmpresaGuia'

/** Colunas para pin + card + backfill de coords. */
const COLUNAS_MAPA =
  'id, nome_fantasia, nome_usuario, categoria, cidade, endereco, bairro, latitude, longitude, foto_url, nota_media, plano, somente_anfitriao, somente_guia, somente_van'

const COLUNAS_MAPA_SEM_DUAL =
  'id, nome_fantasia, nome_usuario, categoria, cidade, endereco, bairro, latitude, longitude, foto_url, nota_media, plano, somente_anfitriao'

/** Mesmo universo do guia (presença pública); sem cap baixo que esconda regulares. */
const LIMITE_MAPA = 500
const CHUNK_IDS = 80
/** Geocode/persist por request — cobre agências dual + CDE sem timeout. */
const MAX_BACKFILL_COORDS = 80

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
    bairro: row.bairro != null && String(row.bairro).trim() ? String(row.bairro).trim() : null,
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

async function fetchEmpresasPresencaChunks(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  ids: string[],
): Promise<{ rows: Record<string, unknown>[]; error: string | null }> {
  const rows: Record<string, unknown>[] = []
  let selectCols = COLUNAS_MAPA

  for (let i = 0; i < ids.length; i += CHUNK_IDS) {
    const slice = ids.slice(i, i + CHUNK_IDS)

    const run = async (comPreview: boolean, cols: string) => {
      const q = aplicarFiltroEmpresasGuiaPlanoOuDegustacao(
        supabase.from('empresas').select(cols).in('id', slice),
        { comPreviewFilter: comPreview },
      )
      return q.order('nota_media', { ascending: false })
    }

    let res = await run(true, selectCols)
    const msg = String(res.error?.message ?? '').toLowerCase()
    if (
      (msg.includes('somente_guia') || msg.includes('somente_van')) &&
      (msg.includes('column') || msg.includes('does not exist'))
    ) {
      selectCols = COLUNAS_MAPA_SEM_DUAL
      res = await run(true, selectCols)
    }
    const previewMsg = String(res.error?.message ?? '').toLowerCase()
    if (previewMsg.includes('somente_modo_apresentacao')) {
      res = await run(false, selectCols)
    }
    if (res.error) {
      return { rows: [], error: String(res.error.message ?? 'Falha ao carregar atrativos do mapa.') }
    }
    for (const row of (res.data ?? []) as Record<string, unknown>[]) {
      rows.push(row)
    }
  }

  return { rows, error: null }
}

/**
 * Mesma elegibilidade do guia (ciclo regular / presença pública vigente).
 * Se faltar lat/lng, geocodifica e persiste (backfill limitado) para o pin aparecer.
 */
export async function buscarEmpresasMapaMobilidade(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<{ lista: EmpresaMapaMobilidade[]; error: string | null }> {
  const idsSet = await buscarIdsEmpresaPresencaPublicaVigente(supabase)
  const ids = [...idsSet]
  if (ids.length === 0) {
    return { lista: [], error: null }
  }

  const { rows, error } = await fetchEmpresasPresencaChunks(supabase, ids)
  if (error) return { lista: [], error }

  const semCoords = rows.filter((r) => !temCoords(r))
  if (semCoords.length > 0) {
    // Prioriza CDE / Serviços Locais (agências dual) no backfill limitado.
    const prioridade = (r: Record<string, unknown>) => {
      const cidade = String(r.cidade ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
      const cat = String(r.categoria ?? '').toLowerCase()
      let score = 0
      if (cidade.includes('este') || cidade.includes('cde') || cidade.includes('leste')) score += 2
      if (cat.includes('servi') || cat.includes('local')) score += 2
      if (r.somente_anfitriao || r.somente_guia || r.somente_van) score += 3
      if (r.endereco) score += 1
      return score
    }
    const ordenados = [...semCoords].sort((a, b) => prioridade(b) - prioridade(a))
    const preenchidos = await backfillCoordsEmpresas(
      supabase,
      ordenados.map((r) => ({
        id: String(r.id),
        endereco: r.endereco != null ? String(r.endereco) : null,
        bairro: r.bairro != null ? String(r.bairro) : null,
        cidade: r.cidade != null ? String(r.cidade) : null,
      })),
      { maxPorRequest: MAX_BACKFILL_COORDS },
    )
    for (const row of rows) {
      const id = String(row.id ?? '')
      const geo = preenchidos.get(id)
      if (geo) {
        row.latitude = geo.lat
        row.longitude = geo.lng
      }
    }
  }

  const byId = new Map<string, EmpresaMapaMobilidade>()
  for (const row of rows) {
    const mapped = mapRow(row)
    if (mapped) byId.set(mapped.id, mapped)
  }

  const lista = [...byId.values()]
    .sort((a, b) => (Number(b.nota_media) || 0) - (Number(a.nota_media) || 0))
    .slice(0, LIMITE_MAPA)

  return { lista, error: null }
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
