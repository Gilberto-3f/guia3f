export const TEXTO_PRE_LIBERACAO_CONFIRME = 'Confirme se você atendeu ou conhece este usuário.'

export function textoPreLiberacaoIntro(username: string): string {
  const user = username.trim() || 'turista'
  return `O turista @${user} solicitou pré-liberação de 24h para compras, reservas e mobilidade no app.`
}

export function mensagemPreLiberacaoPendente(username: string): string {
  return `${textoPreLiberacaoIntro(username)}\n\n${TEXTO_PRE_LIBERACAO_CONFIRME}`
}
