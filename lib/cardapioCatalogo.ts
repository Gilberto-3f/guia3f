/** Cardápio digital (gastronomia) — constantes, tipos e helpers. */

export { COR_AZUL_LOGO, COR_VERDE_BOTAO, FOTOS_MIN, FOTOS_MAX, NOME_PRODUTO_MAX as NOME_PRATO_MAX } from '@/lib/comprasCdeCatalogo'
export {
  precoFinalUsd,
  formatarUsd,
  normalizarTextoTaxonomia,
} from '@/lib/comprasCdeCatalogo'

export const DESCRICAO_PRATO_MAX = 500

export type CardapioCategoriaRow = {
  id: string
  empresa_id: string
  nome: string
  nome_normalizado: string
}

export type PratoCardapioRow = {
  id: string
  empresa_id: string
  nome: string
  descricao: string | null
  preco_usd: number
  percentual_desconto: number
  fotos: string[]
  foto_url: string | null
  site_url: string | null
  ativo: boolean
  categoria_id: string | null
  categoria_nome?: string | null
  created_at?: string
}

export function mapPratoRow(raw: Record<string, unknown>): PratoCardapioRow {
  const catJoin = raw.cardapio_categorias as { id?: unknown; nome?: unknown } | null | undefined
  const fotosRaw = raw.fotos
  const fotos = Array.isArray(fotosRaw)
    ? fotosRaw.map((f) => String(f)).filter((f) => f.trim() !== '')
    : []
  return {
    id: String(raw.id),
    empresa_id: String(raw.empresa_id),
    nome: String(raw.nome ?? ''),
    descricao: raw.descricao != null ? String(raw.descricao) : null,
    preco_usd: Number(raw.preco_usd) || 0,
    percentual_desconto: Number(raw.percentual_desconto) || 0,
    fotos,
    foto_url: raw.foto_url != null && String(raw.foto_url).trim() !== '' ? String(raw.foto_url) : null,
    site_url: raw.site_url != null && String(raw.site_url).trim() !== '' ? String(raw.site_url) : null,
    ativo: Boolean(raw.ativo),
    categoria_id:
      raw.categoria_id != null
        ? String(raw.categoria_id)
        : catJoin?.id != null
          ? String(catJoin.id)
          : null,
    categoria_nome: catJoin?.nome != null ? String(catJoin.nome) : null,
    created_at: raw.created_at != null ? String(raw.created_at) : undefined,
  }
}

export const SELECT_PRATO = `
  id, empresa_id, nome, descricao, preco_usd, percentual_desconto,
  fotos, foto_url, site_url, ativo, categoria_id, created_at,
  cardapio_categorias ( id, nome )
`
