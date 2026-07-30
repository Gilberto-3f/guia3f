import {
  classificarTipoProfissionalCartao,
  normalizarCategoriasProfissional,
} from '@/lib/cartaoVisitaProfissional'

/** Modos de UI da ferramenta de trabalho na Mobilidade. */
export type PainelMobilidadeModo = 'guia_van' | 'taxista' | 'motorista_app' | 'outro'

/**
 * Resolve o painel profissional (Fase B).
 * - motorista_app (sem placa): aviso parceiro, sem toggle
 * - guia / van: toggle + Manifesto + Calendário
 * - taxista: toggle + lista do dia
 */
export function resolverPainelMobilidade(
  placaVermelha: boolean,
  categorias: string[] | null | undefined,
): PainelMobilidadeModo {
  const cats = normalizarCategoriasProfissional(categorias)
  const tipo = classificarTipoProfissionalCartao(placaVermelha, categorias)

  if (tipo === 'motorista_app' || (cats.includes('motorista_app') && !placaVermelha && !cats.includes('guia') && !cats.includes('van') && !cats.includes('taxista'))) {
    return 'motorista_app'
  }
  if (cats.includes('guia') || cats.includes('van')) return 'guia_van'
  if (cats.includes('taxista') || tipo === 'regular') return 'taxista'
  if (cats.includes('motorista_app')) return 'motorista_app'
  return 'outro'
}

/** Capacidade placeholder do manifesto do dia (UI base). */
export const MANIFESTO_CAPACIDADE_PADRAO = 7
