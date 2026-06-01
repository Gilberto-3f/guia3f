/** Título da pasta de canais ADM na lista do perfil admin (Mensageiro ADM). Profissional/empresa mantêm "ADMINISTRAÇÃO". */
export const TITULO_PASTA_ADMINISTRADORES_APP = 'ADMINISTRADORES DO APP'

/**
 * Rótulos na pasta Administração e no cabeçalho do detalhe do canal.
 * Nomes na BD (ADM, Financeiro, Mensageiro ADM) mantêm-se; só a UI muda.
 */
export function nomeNormCanal(nome: string | null | undefined) {
  return (nome ?? '').trim().toUpperCase()
}

/** Canal “mensageiro” a ocultar na lista do perfil admin (visão agrupada). */
export function excluirCanalMensageiroVisaoAdm(c: { nome?: string | null; tipo_publico?: string | null; categoria?: string | null }) {
  const n = nomeNormCanal(c.nome)
  if (c.tipo_publico === 'admin' && c.categoria === 'admin') {
    if (n === 'MENSAGEIRO ADM' || (c.nome ?? '').trim() === 'Mensageiro ADM') return true
  }
  return false
}

/** Mensageiro ADM (canal global admin): sem abas de país/bandeiras. */
export function canalMensageiroAdmSemAbasPais(nome: string | null | undefined) {
  const raw = (nome ?? '').trim()
  const n = nomeNormCanal(raw)
  return (
    n === 'ADM' ||
    n === 'FINANCEIRO' ||
    n === 'MENSAGEIRO' ||
    n === 'MENSAGEIRO ADM' ||
    raw === 'Mensageiro ADM'
  )
}

/** Canal Financeiro na pasta ADMINISTRADORES DO APP (hub ADM — não é chat de comunidade). */
export function isCanalFinanceiroHubAdm(canal: { nome?: string | null }) {
  return nomeNormCanal(canal.nome) === 'FINANCEIRO'
}

/** Lista Administração + título na página do canal (quando for ADM/Financeiro). */
export function rotuloNomeCanalAdministracao(nome: string | null | undefined) {
  const raw = (nome ?? '').trim()
  if (!raw) return 'Canal'
  const n = nomeNormCanal(raw)
  if (n === 'FINANCEIRO') return 'Canal Financeiro'
  if (n === 'ADM' || n === 'MENSAGEIRO' || n === 'MENSAGEIRO ADM' || raw === 'Mensageiro ADM') return 'Mensageiro ADM'
  return raw
}
