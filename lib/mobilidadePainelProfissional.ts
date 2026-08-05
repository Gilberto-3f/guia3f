import {
  classificarTipoProfissionalCartao,
  normalizarCategoriasProfissional,
} from '@/lib/cartaoVisitaProfissional'
import { profissionalTemCategoriaMobilidade } from '@/lib/mobilidadeStatusProfissional'
import { categoriasIncluemAnfitriao } from '@/lib/anfitriaoDualMode'

/** Modos de UI da ferramenta de trabalho na Mobilidade. */
export type PainelMobilidadeModo =
  | 'guia_van'
  | 'taxista'
  | 'motorista_app'
  | 'anfitriao'
  | 'outro'

/** Ações do drawer Espaço Profissional (drawers filhos depois). */
export type EspacoProfissionalAcaoId =
  | 'app_parceiro'
  | 'ecossistema'
  | 'parcerias'
  | 'manifesto'
  | 'calendario'
  | 'historico'
  | 'mobilidade_urbana'

/**
 * Resolve o painel profissional.
 * - motorista_app (sem placa): app parceiro / ecossistema
 * - guia / van: manifesto + calendário + histórico
 * - taxista: calendário + histórico
 * - anfitrião (sem categoria de mobilidade): mobilidade urbana / ecossistema / histórico
 */
export function resolverPainelMobilidade(
  placaVermelha: boolean,
  categorias: string[] | null | undefined,
): PainelMobilidadeModo {
  const cats = normalizarCategoriasProfissional(categorias)
  const tipo = classificarTipoProfissionalCartao(placaVermelha, categorias)

  if (
    tipo === 'motorista_app' ||
    (cats.includes('motorista_app') &&
      !placaVermelha &&
      !cats.includes('guia') &&
      !cats.includes('van') &&
      !cats.includes('taxista'))
  ) {
    return 'motorista_app'
  }
  if (cats.includes('guia') || cats.includes('van')) return 'guia_van'
  if (cats.includes('taxista') || tipo === 'regular') return 'taxista'
  if (cats.includes('motorista_app')) return 'motorista_app'
  if (categoriasIncluemAnfitriao(cats) && !profissionalTemCategoriaMobilidade(cats)) {
    return 'anfitriao'
  }
  return 'outro'
}

/** Botões do Espaço Profissional por categoria. */
export function botoesEspacoProfissional(modo: PainelMobilidadeModo): EspacoProfissionalAcaoId[] {
  if (modo === 'motorista_app') return ['app_parceiro', 'ecossistema', 'parcerias']
  if (modo === 'guia_van') return ['manifesto', 'calendario', 'historico', 'parcerias']
  if (modo === 'taxista') return ['calendario', 'historico', 'parcerias']
  if (modo === 'anfitriao') return ['mobilidade_urbana', 'ecossistema', 'parcerias']
  return ['parcerias']
}

/** Capacidade placeholder do manifesto do dia (UI base). */
export const MANIFESTO_CAPACIDADE_PADRAO = 7
