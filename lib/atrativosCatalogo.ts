import {
  formasPagamentoVazio,
  parseFormasPagamento,
  validarFormasPagamento,
  type FormasPagamentoHospedagem,
} from '@/lib/hospedagemAcomodacoesCatalogo'

export const COR_AZUL_LOGO = '#0097b2'
export const COR_VERDE_BOTAO = '#00D443'
export const DESCRICAO_MAX = 250
export const FOTOS_MIN = 1
export const FOTOS_MAX = 3

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
  type FormasPagamentoHospedagem,
}

export function formatarPrecoTicket(valor: number | null | undefined): string {
  const n = Number(valor)
  if (!Number.isFinite(n)) return '—'
  return `R$ ${n.toFixed(2)}`
}

export function mapExperienciaRow(raw: Record<string, unknown>): AtrativoExperienciaRow {
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
    created_at: raw.created_at != null ? String(raw.created_at) : undefined,
    updated_at: raw.updated_at != null ? String(raw.updated_at) : undefined,
  }
}

export function resumoPrecosAtrativo(item: AtrativoExperienciaRow): string {
  const partes: string[] = []
  if (item.oferece_inteira) partes.push(`Inteira ${formatarPrecoTicket(item.preco_inteira)}`)
  if (item.oferece_meia) partes.push(`Meia ${formatarPrecoTicket(item.preco_meia)}`)
  return partes.join(' · ') || 'Sem preço'
}
