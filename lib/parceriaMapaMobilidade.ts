import {
  classificarTipoProfissionalCartao,
  profissionalIndireto,
  type TipoProfissionalCartao,
} from '@/lib/cartaoVisitaProfissional'
import { normalizarChaveCidadeGuia, VARIANTES_CIDADE_GUIA } from '@/lib/segmentosEmpresaGuia'

export type ContextoMapaMobilidade = 'turista' | 'prof_parceiro' | null

export type ResultadoIndicacaoAtrativoMapa = {
  permitido: boolean
  motivo: string | null
  avisoGuia: string
}

export const AVISO_GUIA_ACOMPANHAMENTO =
  'Para acompanhamento particular, atendimento em idioma específico ou roteiro guiado, indique um Guia de Turismo — não um motorista de app ou transporte simples.'

/** Chave canônica da cidade (Foz / CDE / Puerto) para comparação. */
export function chaveCanonicaCidadeParceria(cidade: string | null | undefined): string | null {
  const n = normalizarChaveCidadeGuia(cidade)
  if (!n) return null
  for (const [chave, variantes] of Object.entries(VARIANTES_CIDADE_GUIA)) {
    const aliases = [chave, ...variantes.map((v) => normalizarChaveCidadeGuia(v))]
    if (aliases.includes(n)) return chave
  }
  return n
}

export function cidadesParceriaCoincidem(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const ka = chaveCanonicaCidadeParceria(a)
  const kb = chaveCanonicaCidadeParceria(b)
  if (!ka || !kb) return false
  return ka === kb
}

export function empresaNaAreaDoProfissional(
  empresaCidade: string | null | undefined,
  profCidades: string[] | null | undefined,
): boolean {
  const cidades = (profCidades ?? []).map((c) => String(c ?? '').trim()).filter(Boolean)
  if (!cidades.length) return true
  const alvo = String(empresaCidade ?? '').trim()
  if (!alvo) return false
  return cidades.some((c) => cidadesParceriaCoincidem(c, alvo))
}

export function visitanteEhProfissionalIndireto(
  placaVermelha: boolean,
  categorias: string[] | null | undefined,
): boolean {
  if (placaVermelha) return false
  const tipo = classificarTipoProfissionalCartao(false, categorias)
  return profissionalIndireto(tipo)
}

/** Contexto do botão secundário no perfil simples do atrativo no mapa. */
export function resolverContextoMapaMobilidade(params: {
  perfilEhTurista: boolean
  perfilEhProfissional: boolean
  visitantePlacaVermelha: boolean
  visitanteCategorias: string[] | null | undefined
}): ContextoMapaMobilidade {
  if (params.perfilEhTurista) return 'turista'
  if (
    params.perfilEhProfissional &&
    visitanteEhProfissionalIndireto(params.visitantePlacaVermelha, params.visitanteCategorias)
  ) {
    return 'prof_parceiro'
  }
  return null
}

/**
 * Regras 3.5 — botão "Indicar Parceiro" no pin de atrativo.
 * Anfitrião: só atrativos na mesma cidade de atuação.
 * Motorista de app: liberado em qualquer cidade (fronteira / destino).
 */
export function podeIndicarAtrativoMapa(params: {
  visitantePlacaVermelha: boolean
  visitanteCategorias: string[] | null | undefined
  visitanteCidadesAtuacao: string[] | null | undefined
  empresaCidade: string | null | undefined
}): ResultadoIndicacaoAtrativoMapa {
  const avisoGuia = AVISO_GUIA_ACOMPANHAMENTO

  if (params.visitantePlacaVermelha) {
    return {
      permitido: false,
      motivo: 'Indicação de parceiro é exclusiva de motoristas de app e anfitriões.',
      avisoGuia,
    }
  }

  const tipo = classificarTipoProfissionalCartao(false, params.visitanteCategorias)

  if (!profissionalIndireto(tipo)) {
    return {
      permitido: false,
      motivo: 'Seu perfil não participa do programa de indicação com comissão.',
      avisoGuia,
    }
  }

  const mesmaCidade = empresaNaAreaDoProfissional(params.empresaCidade, params.visitanteCidadesAtuacao)

  if (tipo === 'anfitriao' && !mesmaCidade) {
    return {
      permitido: false,
      motivo:
        'Anfitriões só podem indicar atrativos na mesma cidade em que atuam. Para outras cidades, indique um Guia ou motorista com placa vermelha.',
      avisoGuia,
    }
  }

  return { permitido: true, motivo: null, avisoGuia }
}

export function rotuloBotaoIndicacaoMapa(tipo: TipoProfissionalCartao): string {
  if (profissionalIndireto(tipo)) return 'INDICAR PARCEIRO'
  return 'RECOMENDAR'
}
