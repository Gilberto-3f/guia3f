import { categoriaProfissionalParaSlug } from '@/lib/canaisProfissionalSlugs'

export type VisaoCartaoVisita =
  | 'turista'
  | 'empresa'
  | 'profissional_dono'
  | 'profissional_visitante'
  | 'visitante_anonimo'

export type TipoProfissionalCartao = 'regular' | 'motorista_app' | 'anfitriao' | 'outro'

export type AcoesCartaoVisitaProfissional = {
  mostrarContratar: boolean
  mostrarRecomendar: boolean
  mostrarAvaliar: boolean
  avaliarHabilitado: boolean
}

/** Normaliza categorias do banco para slugs comparáveis. */
export function normalizarCategoriasProfissional(categorias: string[] | null | undefined): string[] {
  if (!Array.isArray(categorias)) return []
  return categorias
    .map((c) => categoriaProfissionalParaSlug(String(c ?? '')))
    .filter(Boolean)
}

/** Classifica o perfil profissional visitado ou visitante. */
export function classificarTipoProfissionalCartao(
  placaVermelha: boolean,
  categorias: string[] | null | undefined,
): TipoProfissionalCartao {
  if (placaVermelha) return 'regular'
  const cats = normalizarCategoriasProfissional(categorias)
  if (cats.includes('anfitriao')) return 'anfitriao'
  if (cats.includes('motorista_app')) return 'motorista_app'
  return 'outro'
}

/**
 * Regra do botão contratar para turista/empresa (UI):
 * - Permitido: taxista, motorista de van, guia, placa vermelha
 * - Bloqueado: motorista de app, anfitrião
 */
export function perfilVisitadoPermiteContratar(
  placaVermelha: boolean,
  categorias: string[] | null | undefined,
): boolean {
  if (placaVermelha) return true
  const cats = normalizarCategoriasProfissional(categorias)
  if (cats.includes('anfitriao')) return false
  if (cats.includes('motorista_app')) return false
  if (cats.includes('taxista')) return true
  if (cats.includes('van')) return true
  if (cats.includes('guia')) return true
  return false
}

/**
 * Resolve quais botões exibir no cartão de visita conforme a visão do visitante.
 */
export function resolverAcoesCartaoVisitaProfissional(params: {
  visao: VisaoCartaoVisita
  profissionalVerificado: boolean
  visitantePlacaVermelha: boolean
  visitanteCategorias: string[] | null | undefined
  visitadoPlacaVermelha: boolean
  visitadoCategorias: string[] | null | undefined
  temParceriaFechada: boolean
}): AcoesCartaoVisitaProfissional {
  const base: AcoesCartaoVisitaProfissional = {
    mostrarContratar: false,
    mostrarRecomendar: false,
    mostrarAvaliar: false,
    avaliarHabilitado: false,
  }

  if (!params.profissionalVerificado) return base

  const visitadoTipo = classificarTipoProfissionalCartao(
    params.visitadoPlacaVermelha,
    params.visitadoCategorias,
  )

  if (params.visao === 'profissional_dono') return base

  if (params.visao === 'turista' || params.visao === 'empresa') {
    return {
      mostrarContratar: perfilVisitadoPermiteContratar(
        params.visitadoPlacaVermelha,
        params.visitadoCategorias,
      ),
      mostrarRecomendar: false,
      mostrarAvaliar: true,
      avaliarHabilitado: false,
    }
  }

  if (params.visao !== 'profissional_visitante') return base

  const visitanteTipo = classificarTipoProfissionalCartao(
    params.visitantePlacaVermelha,
    params.visitanteCategorias,
  )

  let mostrarRecomendar = false

  if (visitanteTipo === 'regular') {
    if (visitadoTipo === 'regular' || visitadoTipo === 'anfitriao') {
      mostrarRecomendar = true
    }
  } else if (visitanteTipo === 'motorista_app') {
    if (visitadoTipo === 'regular' || visitadoTipo === 'anfitriao') {
      mostrarRecomendar = true
    }
  } else if (visitanteTipo === 'anfitriao') {
    if (visitadoTipo === 'regular') {
      mostrarRecomendar = true
    }
  }

  return {
    mostrarContratar: false,
    mostrarRecomendar,
    mostrarAvaliar: true,
    avaliarHabilitado: params.temParceriaFechada,
  }
}

export function resolverVisaoCartaoVisita(params: {
  meuId: string | null
  profileId: string
  meuRole: string | null
  souDono: boolean
}): VisaoCartaoVisita {
  if (!params.meuId) return 'visitante_anonimo'
  if (params.souDono && params.meuRole === 'profissional') return 'profissional_dono'
  if (params.meuRole === 'turista') return 'turista'
  if (params.meuRole === 'empresa') return 'empresa'
  if (params.meuRole === 'profissional' && params.meuId !== params.profileId) {
    return 'profissional_visitante'
  }
  return 'visitante_anonimo'
}
