import {
  categoriaProfissionalParaSlug,
  type CategoriaProfissionalSlug,
} from '@/lib/canaisProfissionalSlugs'
import { normalizarCategoriasProfissional } from '@/lib/cartaoVisitaProfissional'

export type DestinoContratacaoRecomendacao =
  | { tipo: 'empresa_reserva'; empresaId: string }
  | { tipo: 'mobilidade_canal'; profissionalUsuarioId: string }
  | { tipo: 'api_parceiro'; url: string }
  | { tipo: 'canal' }

/** Slug principal do profissional indicado (primeira categoria conhecida). */
export function slugCategoriaIndicado(
  categorias: string[] | null | undefined,
  placaVermelha = false,
): CategoriaProfissionalSlug | 'outro' {
  const cats = normalizarCategoriasProfissional(categorias)
  if (cats.includes('anfitriao')) return 'anfitriao'
  if (cats.includes('motorista_app')) return 'motorista_app'
  if (cats.includes('taxista')) return 'taxista'
  if (cats.includes('van')) return 'van'
  if (cats.includes('guia')) return 'guia'
  if (placaVermelha) return 'taxista' // placa vermelha → fluxo mobilidade/canal
  return 'outro'
}

/**
 * Destino do turista após CONTRATAR na indicação.
 * A matriz depende da categoria do indicado (quem foi recomendado).
 */
export function resolverDestinoContratacaoRecomendacao(params: {
  categoriasIndicado: string[] | null | undefined
  placaVermelhaIndicado?: boolean
  empresaHospedagemId?: string | null
  profissionalUsuarioId: string
  apiMobilidadeUrl?: string | null
}): DestinoContratacaoRecomendacao {
  const slug = slugCategoriaIndicado(params.categoriasIndicado, Boolean(params.placaVermelhaIndicado))

  if (slug === 'anfitriao') {
    const empId = String(params.empresaHospedagemId ?? '').trim()
    if (empId) return { tipo: 'empresa_reserva', empresaId: empId }
    return { tipo: 'canal' }
  }

  if (slug === 'motorista_app') {
    const url = String(params.apiMobilidadeUrl ?? '').trim()
    if (url) return { tipo: 'api_parceiro', url }
    return { tipo: 'mobilidade_canal', profissionalUsuarioId: params.profissionalUsuarioId }
  }

  // taxista, van, guia, outro → contratação particular (canal / mobilidade do app)
  return { tipo: 'mobilidade_canal', profissionalUsuarioId: params.profissionalUsuarioId }
}

export function precisaDadosPaxManifesto(
  categoriasIndicado: string[] | null | undefined,
  placaVermelhaIndicado: boolean,
): boolean {
  // Manifesto: placa vermelha + Guia de Turismo ou Motorista de Van (não anfitrião).
  if (!placaVermelhaIndicado) return false
  const cats = normalizarCategoriasProfissional(categoriasIndicado)
  return cats.includes('guia') || cats.includes('van')
}

/** Aviso de manifesto no canal financeiro (ocultar para anfitrião). */
export function itemCanalFinanceiroEhAvisoManifesto(item: {
  tipo?: string | null
  titulo?: string | null
  mensagem?: string | null
}): boolean {
  const tipo = String(item.tipo ?? '')
  if (tipo === 'manifesto' || tipo === 'manifesto_indicacao') return true
  const titulo = String(item.titulo ?? '').toLowerCase()
  const mensagem = String(item.mensagem ?? '').toLowerCase()
  return titulo.includes('manifesto') || mensagem.includes('manifesto')
}

export function hrefDestinoContratacao(
  destino: DestinoContratacaoRecomendacao,
  recomendacaoId?: string | null,
): string | null {
  const rec = String(recomendacaoId ?? '').trim()
  const recQs = rec ? `&rec=${encodeURIComponent(rec)}` : ''

  if (destino.tipo === 'empresa_reserva') {
    return `/empresa/${destino.empresaId}?ref=recomendacao&abrir=reserva${recQs}`
  }
  if (destino.tipo === 'mobilidade_canal') {
    return `/canal?contratar=${encodeURIComponent(destino.profissionalUsuarioId)}${
      rec ? `&rec=${encodeURIComponent(rec)}` : ''
    }`
  }
  if (destino.tipo === 'api_parceiro') return destino.url
  if (destino.tipo === 'canal') return '/canal'
  return null
}

export function categoriaSlugDeRotulo(rotulo: string): string {
  return categoriaProfissionalParaSlug(rotulo)
}
