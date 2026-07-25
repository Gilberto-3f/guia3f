import {
  formasPagamentoVazio,
  parseFormasPagamento,
  validarFormasPagamento,
  type FormasPagamentoHospedagem,
} from '@/lib/hospedagemAcomodacoesCatalogo'
import { normalizarTextoTaxonomia } from '@/lib/comprasCdeCatalogo'
import {
  formatarPrecoMoedaPadrao,
  type MoedaPadraoLoja,
} from '@/lib/comprasCdeMoedaPadrao'

export const COR_AZUL_LOGO = '#0097b2'
export const COR_VERDE_BOTAO = '#00D443'
export const DESCRICAO_MAX = 250
export const FOTOS_MIN = 1
export const FOTOS_MAX = 3
export const TITULO_ATRATO_MAX = 30

export type AtrativoCategoriaRow = {
  id: string
  empresa_id: string
  nome: string
  nome_normalizado: string
}

export type AtrativoExperienciaRow = {
  id: string
  empresa_id: string
  titulo: string
  descricao: string
  fotos: string[]
  oferece_inteira: boolean
  preco_inteira: number | null
  oferece_meia: boolean
  preco_meia: number | null
  ativo: boolean
  categoria_id: string | null
  categoria_nome?: string | null
  site_url: string | null
  created_at?: string
  updated_at?: string
}

export type AtrativosPoliticasRow = {
  empresa_id: string
  formas_pagamento: FormasPagamentoHospedagem
  regras_meia_entrada: string
  updated_at?: string
}

export type TipoTicketAtrativo = 'inteira' | 'meia'

export {
  formasPagamentoVazio,
  parseFormasPagamento,
  validarFormasPagamento,
  normalizarTextoTaxonomia,
  type FormasPagamentoHospedagem,
}

export function formatarPrecoTicket(
  valor: number | null | undefined,
  moeda: MoedaPadraoLoja = 'BRL',
): string {
  const n = Number(valor)
  if (!Number.isFinite(n)) return '—'
  return formatarPrecoMoedaPadrao(n, moeda)
}

export function mapExperienciaRow(raw: Record<string, unknown>): AtrativoExperienciaRow {
  const catJoin = raw.atrativos_categorias as { id?: unknown; nome?: unknown } | null | undefined
  return {
    id: String(raw.id),
    empresa_id: String(raw.empresa_id),
    titulo: String(raw.titulo ?? ''),
    descricao: String(raw.descricao ?? ''),
    fotos: Array.isArray(raw.fotos) ? raw.fotos.map(String) : [],
    oferece_inteira: Boolean(raw.oferece_inteira),
    preco_inteira:
      raw.preco_inteira != null && Number.isFinite(Number(raw.preco_inteira))
        ? Number(raw.preco_inteira)
        : null,
    oferece_meia: Boolean(raw.oferece_meia),
    preco_meia:
      raw.preco_meia != null && Number.isFinite(Number(raw.preco_meia))
        ? Number(raw.preco_meia)
        : null,
    ativo: raw.ativo == null ? true : Boolean(raw.ativo),
    categoria_id:
      raw.categoria_id != null
        ? String(raw.categoria_id)
        : catJoin?.id != null
          ? String(catJoin.id)
          : null,
    categoria_nome: catJoin?.nome != null ? String(catJoin.nome) : null,
    site_url:
      raw.site_url != null && String(raw.site_url).trim() !== '' ? String(raw.site_url).trim() : null,
    created_at: raw.created_at != null ? String(raw.created_at) : undefined,
    updated_at: raw.updated_at != null ? String(raw.updated_at) : undefined,
  }
}

export const SELECT_ATRATO_EXPERIENCIA = `
  id, empresa_id, titulo, descricao, fotos,
  oferece_inteira, preco_inteira, oferece_meia, preco_meia,
  ativo, categoria_id, site_url, created_at, updated_at,
  atrativos_categorias ( id, nome )
`

export function resumoPrecosAtrativo(
  item: AtrativoExperienciaRow,
  moeda: MoedaPadraoLoja = 'BRL',
): string {
  const partes: string[] = []
  if (item.oferece_inteira) partes.push(`Inteira ${formatarPrecoTicket(item.preco_inteira, moeda)}`)
  if (item.oferece_meia) partes.push(`Meia ${formatarPrecoTicket(item.preco_meia, moeda)}`)
  return partes.join(' · ') || 'Sem preço'
}
