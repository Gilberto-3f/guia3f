import { formatarUsd } from '@/lib/comprasCdeCatalogo'
import { converterMoedas, type CotacaoMap } from '@/lib/comprasCdeHub'
import {
  FLAG_MOEDA_CDE,
  LABEL_MOEDA_CDE,
  formatarMoedaExibicaoCde,
  type MoedaExibicaoCde,
} from '@/lib/comprasCdeMoedaExibicao'

/** Moedas que a loja pode escolher como padrão (cadastro + destaque nos cards). */
export const MOEDAS_PADRAO_LOJA = ['USD', 'BRL', 'ARS', 'PYG'] as const
export type MoedaPadraoLoja = (typeof MOEDAS_PADRAO_LOJA)[number]

/** Pool completo do conversor visitante (inclui EUR; exclui a moeda padrão em runtime). */
export const MOEDAS_CONVERSOR_POOL = ['USD', 'BRL', 'PYG', 'ARS', 'EUR'] as const
export type MoedaConversorPool = (typeof MOEDAS_CONVERSOR_POOL)[number]

export function isMoedaPadraoLoja(v: unknown): v is MoedaPadraoLoja {
  return typeof v === 'string' && (MOEDAS_PADRAO_LOJA as readonly string[]).includes(v)
}

export function normalizarMoedaPadrao(v: unknown): MoedaPadraoLoja {
  return isMoedaPadraoLoja(v) ? v : 'USD'
}

export const LABEL_MOEDA_PADRAO: Record<MoedaPadraoLoja, string> = {
  USD: 'Dólar',
  BRL: 'Real',
  ARS: 'Peso argentino',
  PYG: 'Guaraní',
}

export const FLAG_MOEDA_PADRAO: Record<MoedaPadraoLoja, string> = {
  USD: '🇺🇸',
  BRL: '🇧🇷',
  ARS: '🇦🇷',
  PYG: '🇵🇾',
}

/** Label do input de preço no formulário. */
export function labelValorFormProduto(moeda: MoedaPadraoLoja): string {
  switch (moeda) {
    case 'BRL':
      return 'Valor (R$) *'
    case 'ARS':
      return 'Valor (AR$) *'
    case 'PYG':
      return 'Valor (₲) *'
    default:
      return 'Valor (USD) *'
  }
}

export function formatarPrecoMoedaPadrao(valor: number, moeda: MoedaPadraoLoja): string {
  if (moeda === 'USD') return formatarUsd(valor)
  return formatarMoedaExibicaoCde(valor, moeda)
}

/** USD → valor na moeda padrão (para exibir no form / card). */
export function usdParaMoedaPadrao(
  usd: number,
  moeda: MoedaPadraoLoja,
  cotacoes: CotacaoMap,
): number {
  if (moeda === 'USD') return Math.max(0, Number(usd) || 0)
  return converterMoedas(usd, 'USD', moeda, cotacoes)
}

/** Valor digitado na moeda padrão → USD (para gravar em preco_usd). */
export function moedaPadraoParaUsd(
  valor: number,
  moeda: MoedaPadraoLoja,
  cotacoes: CotacaoMap,
): number {
  const v = Math.max(0, Number(valor) || 0)
  if (moeda === 'USD') return v
  return converterMoedas(v, moeda, 'USD', cotacoes)
}

export function moedasConversorSemPadrao(moedaPadrao: MoedaPadraoLoja): MoedaConversorPool[] {
  return MOEDAS_CONVERSOR_POOL.filter((m) => m !== moedaPadrao)
}

export function flagLabelConversor(moeda: MoedaConversorPool): { flag: string; label: string } {
  if (moeda === 'USD') return { flag: '🇺🇸', label: 'Dólar' }
  return {
    flag: FLAG_MOEDA_CDE[moeda as MoedaExibicaoCde],
    label: LABEL_MOEDA_CDE[moeda as MoedaExibicaoCde],
  }
}

export function formatarMoedaConversor(valor: number, moeda: MoedaConversorPool): string {
  if (moeda === 'USD') return formatarUsd(valor)
  return formatarMoedaExibicaoCde(valor, moeda as MoedaExibicaoCde)
}

export function usdParaMoedaConversor(
  usd: number,
  moeda: MoedaConversorPool,
  cotacoes: CotacaoMap,
): number {
  if (moeda === 'USD') return Math.max(0, Number(usd) || 0)
  return converterMoedas(usd, 'USD', moeda, cotacoes)
}
