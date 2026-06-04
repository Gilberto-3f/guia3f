/** @typedef {'liberado' | 'aguardando_adm' | 'pendente_docs'} FaseVerificacaoConta */

export const TITULO_BLOQUEIO_CONTA = 'Serviço indisponível'

const MSG_TURISTA_PENDENTE =
  'Para usar compras e reservas no Guia, cadastre e envie seus documentos para verificação dos administradores.'
const CAMINHO_TURISTA = 'Menu → USUÁRIO → Anexar Documentos.'

const MSG_TURISTA_AGUARDANDO =
  'Seus documentos foram enviados e estão em análise. Aguarde a verificação e liberação definitiva pelos administradores do app.'

const MSG_PROF_PENDENTE =
  'Para usar os recursos de profissional, cadastre e envie sua documentação para verificação dos administradores.'
const CAMINHO_PROF = 'Menu → USUÁRIO → Anexar Documentos.'

const MSG_PROF_AGUARDANDO =
  'Sua documentação foi enviada e está em análise. Aguarde a verificação e liberação definitiva pelos administradores do app.'

/**
 * @param {'turista' | 'profissional'} perfil
 * @param {FaseVerificacaoConta} fase
 */
export function mensagemBloqueioVerificacao(perfil, fase) {
  if (fase === 'liberado') return ''
  if (perfil === 'turista') {
    if (fase === 'aguardando_adm') return MSG_TURISTA_AGUARDANDO
    return `${MSG_TURISTA_PENDENTE} ${CAMINHO_TURISTA}`
  }
  if (fase === 'aguardando_adm') return MSG_PROF_AGUARDANDO
  return `${MSG_PROF_PENDENTE} ${CAMINHO_PROF}`
}

export const MSG_PRE_LIBERACAO_REQUER_DOCS =
  'Envie seus documentos em Menu → USUÁRIO → Anexar Documentos antes de solicitar a pré-liberação. Assim o profissional poderá vincular suas compras no app.'
