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

/** Lista Administração + título na página do canal (quando for ADM/Financeiro). */
export function rotuloNomeCanalAdministracao(nome: string | null | undefined) {
  const raw = (nome ?? '').trim()
  if (!raw) return 'Canal'
  const n = nomeNormCanal(raw)
  if (n === 'FINANCEIRO') return 'Canal Financeiro'
  if (n === 'ADM' || n === 'MENSAGEIRO' || n === 'MENSAGEIRO ADM' || raw === 'Mensageiro ADM') return 'Canal ADM'
  return raw
}
