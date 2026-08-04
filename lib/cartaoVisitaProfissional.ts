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
  mostrarRecomendarMobilidade: boolean
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

export function profissionalIndireto(tipo: TipoProfissionalCartao): boolean {
  return tipo === 'motorista_app' || tipo === 'anfitriao'
}

/**
 * Regra do botão contratar para turista/empresa (UI):
 * - Anfitrião: contratar (hospedagem)
 * - Placa vermelha / taxista / van / guia: contratar
 * - Motorista de app: sem contratar direto no cartão
 */
export function perfilVisitadoPermiteContratar(
  placaVermelha: boolean,
  categorias: string[] | null | undefined,
): boolean {
  const visitadoTipo = classificarTipoProfissionalCartao(placaVermelha, categorias)
  if (visitadoTipo === 'anfitriao') return true
  if (placaVermelha) return true
  const cats = normalizarCategoriasProfissional(categorias)
  if (cats.includes('motorista_app')) return false
  if (cats.includes('taxista')) return true
  if (cats.includes('van')) return true
  if (cats.includes('guia')) return true
  return false
}

/** Turista/empresa: avaliar liberado para indiretos; regular só após contratação. */
export function resolverAvaliarVisaoTurista(
  visitadoTipo: TipoProfissionalCartao,
  turistaContratouProfissional: boolean,
): { mostrar: boolean; habilitado: boolean } {
  if (profissionalIndireto(visitadoTipo)) {
    return { mostrar: true, habilitado: true }
  }
  if (visitadoTipo === 'regular') {
    return { mostrar: true, habilitado: turistaContratouProfissional }
  }
  return { mostrar: true, habilitado: false }
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
  turistaContratouProfissional?: boolean
}): AcoesCartaoVisitaProfissional {
  const base: AcoesCartaoVisitaProfissional = {
    mostrarContratar: false,
    mostrarRecomendar: false,
    mostrarRecomendarMobilidade: false,
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
    const avaliar = resolverAvaliarVisaoTurista(
      visitadoTipo,
      Boolean(params.turistaContratouProfissional),
    )
    return {
      mostrarContratar: perfilVisitadoPermiteContratar(
        params.visitadoPlacaVermelha,
        params.visitadoCategorias,
      ),
      mostrarRecomendar: false,
      mostrarRecomendarMobilidade: false,
      mostrarAvaliar: avaliar.mostrar,
      avaliarHabilitado: avaliar.habilitado,
    }
  }

  if (params.visao !== 'profissional_visitante') return base

  const visitanteTipo = classificarTipoProfissionalCartao(
    params.visitantePlacaVermelha,
    params.visitanteCategorias,
  )

  let mostrarRecomendar = false
  let mostrarRecomendarMobilidade = false

  if (visitanteTipo === 'anfitriao' && visitadoTipo === 'motorista_app') {
    mostrarRecomendarMobilidade = true
  } else if (visitanteTipo === 'regular') {
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
    mostrarRecomendarMobilidade,
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
  // Adm contrata como turista (atendimento para si).
  if (params.meuRole === 'turista' || params.meuRole === 'admin') return 'turista'
  if (params.meuRole === 'empresa') return 'empresa'
  if (params.meuRole === 'profissional' && params.meuId !== params.profileId) {
    return 'profissional_visitante'
  }
  return 'visitante_anonimo'
}

export function tituloAvaliarDesabilitadoCartao(params: {
  visao: VisaoCartaoVisita
  visitadoPlacaVermelha: boolean
  visitadoCategorias: string[] | null | undefined
}): string {
  if (params.visao === 'profissional_visitante') {
    return 'Disponível após fechar parceria com este profissional'
  }
  const visitadoTipo = classificarTipoProfissionalCartao(
    params.visitadoPlacaVermelha,
    params.visitadoCategorias,
  )
  if (visitadoTipo === 'regular') {
    return 'Disponível após contratar este profissional'
  }
  return 'Disponível após conclusão de serviço'
}
