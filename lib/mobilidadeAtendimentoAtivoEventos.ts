/** Eventos da UI de atendimento ativo (drawer ↔ cards flutuantes). */

export const MOBILIDADE_ABRIR_DRAWER_ATIVO = 'mobilidade:abrir-drawer-ativo'
export const MOBILIDADE_CORRIDA_ATIVA = 'mobilidade:corrida-ativa'
/** Payload do poll do turista → card flutuante (sem segundo GET). */
export const MOBILIDADE_CORRIDA_TURISTA = 'mobilidade:corrida-turista'
/** Payload do poll do profissional → card de status (sem segundo GET). */
export const MOBILIDADE_CORRIDA_PRO = 'mobilidade:corrida-pro'
/** Cancela busca: zera destino/autocomplete do card flutuante. */
export const MOBILIDADE_LIMPAR_PESQUISA = 'mobilidade:limpar-pesquisa'

export type ParteCorridaFlutuante = {
  nome: string
  username: string | null
  foto_url: string | null
  verificado: boolean
  nota_media: number | null
}

export type CorridaTuristaFlutuante = {
  solicitacao_id: string
  status: string
  data_agendada?: string | null
  modalidade?: string | null
  profissional?: ParteCorridaFlutuante | null
}

export type CorridaProFlutuante = {
  solicitacao_id: string
  status: string
  data_agendada?: string | null
  turista?: ParteCorridaFlutuante | null
  lista_iniciada?: boolean
}

export function pedirAbrirDrawerAtendimentoAtivo(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(MOBILIDADE_ABRIR_DRAWER_ATIVO))
}

export function avisarCorridaAtivaAtualizada(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(MOBILIDADE_CORRIDA_ATIVA))
}

export function avisarCorridaTuristaPoll(corrida: CorridaTuristaFlutuante | null): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(MOBILIDADE_CORRIDA_TURISTA, { detail: corrida }))
}

export function avisarCorridaProPoll(corrida: CorridaProFlutuante | null): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(MOBILIDADE_CORRIDA_PRO, { detail: corrida }))
}

/** Payload completo para o mapa (trajeto / pins). O listener global dispara; o mapa lê no mount. */
export const MOBILIDADE_CORRIDA_PRO_MAPA = 'mobilidade:corrida-pro-mapa'

export type CorridaProMapaDetalhe = {
  status?: string | null
  data_agendada?: string | null
  origem_nome?: string | null
  destino_nome?: string | null
  lat_origem?: number | null
  lng_origem?: number | null
  lat_destino?: number | null
  lng_destino?: number | null
  prof_lat?: number | null
  prof_lng?: number | null
  modalidade?: string | null
  lista_iniciada?: boolean
}

let ultimoCorridaProMapa: CorridaProMapaDetalhe | null = null

export function peekCorridaProMapa(): CorridaProMapaDetalhe | null {
  return ultimoCorridaProMapa
}

export function avisarCorridaProMapa(corrida: CorridaProMapaDetalhe | null): void {
  ultimoCorridaProMapa = corrida
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(MOBILIDADE_CORRIDA_PRO_MAPA, { detail: corrida }))
}

export function avisarLimparPesquisaMobilidade(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(MOBILIDADE_LIMPAR_PESQUISA))
}

export const MOBILIDADE_LISTA_INICIADA = 'mobilidade:lista-iniciada'
export const MOBILIDADE_ABRIR_MANIFESTO = 'mobilidade:abrir-manifesto'

export function avisarListaIniciada(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(MOBILIDADE_LISTA_INICIADA))
}

export function pedirAbrirManifestoEspaco(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(MOBILIDADE_ABRIR_MANIFESTO))
}

/** Atendimento imediato (sem data_agendada) — escopo do floating pós-aceite. */
export function ehAtendimentoImediatoAtivo(params: {
  status: string | null | undefined
  data_agendada?: string | null
}): boolean {
  const st = String(params.status ?? '')
  if (!['aceita', 'a_caminho', 'no_local', 'em_viagem'].includes(st)) return false
  return !params.data_agendada
}
