/** Textos de ajuda exibidos no ícone (i) antes do título dos drawers do menu lateral. */
export const DRAWER_INFO_TEXTO: Record<string, string> = {
  tabela:
    'Valores de referência para deslocamento (rotas) da sua categoria (tickets e ingressos de atrativos são negociados à parte).',
  'recomendacoes-feitas':
    'Histórico das recomendações que você fez pelo cartão de visita. Indicações pelo Ecossistema só entram aqui quando o profissional indicado ainda não foi contratado. Contatos dos turistas aparecem mascarados por privacidade.',
  'cadastrar-hospedagem-anfitriao':
    'Cadastre seu negócio de hospedagem vinculado ao perfil de Anfitrião. Após a aprovação do administrador, você poderá alternar entre os modos Anfitrião e Hospedagem no menu.',
  'calendario-reservas-hospedagem':
    'Veja a disponibilidade de cada acomodação e bloqueie datas reservadas em outros canais.',
}

export function textoInfoDrawer(paginaId: string | undefined): string | null {
  if (!paginaId) return null
  return DRAWER_INFO_TEXTO[paginaId] ?? null
}
