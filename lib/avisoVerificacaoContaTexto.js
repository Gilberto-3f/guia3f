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

const MSG_EMPRESA_PENDENTE =
  'Para usar compras e reservas no Guia, envie a documentação da empresa para verificação dos administradores.'
const CAMINHO_EMPRESA = 'Menu → USUÁRIO → Anexar Documentos.'

const MSG_EMPRESA_AGUARDANDO =
  'A documentação da empresa foi enviada e está em análise. Aguarde a verificação e liberação definitiva pelos administradores do app.'

/**
 * @param {'turista' | 'profissional' | 'empresa'} perfil
 * @param {FaseVerificacaoConta} fase
 */
export function mensagemBloqueioVerificacao(perfil, fase) {
  if (fase === 'liberado') return ''
  if (perfil === 'turista') {
    if (fase === 'aguardando_adm') return MSG_TURISTA_AGUARDANDO
    return `${MSG_TURISTA_PENDENTE} ${CAMINHO_TURISTA}`
  }
  if (perfil === 'empresa') {
    if (fase === 'aguardando_adm') return MSG_EMPRESA_AGUARDANDO
    return `${MSG_EMPRESA_PENDENTE} ${CAMINHO_EMPRESA}`
  }
  if (fase === 'aguardando_adm') return MSG_PROF_AGUARDANDO
  return `${MSG_PROF_PENDENTE} ${CAMINHO_PROF}`
}

export const MSG_PRE_LIBERACAO_REQUER_DOCS =
  'Envie seus documentos em Menu → USUÁRIO → Anexar Documentos antes de solicitar a pré-liberação. Assim o profissional poderá vincular suas compras no app.'

export const TITULO_BLOQUEIO_FEED = 'Modo leitura no feed'

const LEITURA_APENAS_CURTIDAS =
  ' Enquanto isso, você pode navegar e curtir publicações, mas não comentar, avaliar, publicar, repostar ou compartilhar.'

const MSG_TURISTA_FEED_PENDENTE =
  'Para interagir no feed (comentários, avaliações, publicações, reposts e compartilhamentos), envie seus documentos e aguarde a verificação definitiva dos administradores.' +
  LEITURA_APENAS_CURTIDAS

const MSG_TURISTA_FEED_AGUARDANDO =
  'Seus documentos estão em análise. O feed permanece em modo leitura até a liberação definitiva pelos administradores — a pré-liberação de 24h não libera essas interações.' +
  LEITURA_APENAS_CURTIDAS

const MSG_PROF_FEED_PENDENTE =
  'Para interagir no feed, envie sua documentação e aguarde a verificação definitiva dos administradores.' +
  LEITURA_APENAS_CURTIDAS

const MSG_PROF_FEED_AGUARDANDO =
  'Sua documentação está em análise. O feed permanece em modo leitura até a liberação definitiva pelos administradores.' +
  LEITURA_APENAS_CURTIDAS

/**
 * @param {'turista' | 'profissional'} perfil
 * @param {FaseVerificacaoConta} fase
 */
export function mensagemBloqueioFeedSocial(perfil, fase) {
  if (fase === 'liberado') return ''
  if (perfil === 'turista') {
    if (fase === 'aguardando_adm') return MSG_TURISTA_FEED_AGUARDANDO
    return `${MSG_TURISTA_FEED_PENDENTE} ${CAMINHO_TURISTA}`
  }
  if (fase === 'aguardando_adm') return MSG_PROF_FEED_AGUARDANDO
  return `${MSG_PROF_FEED_PENDENTE} ${CAMINHO_PROF}`
}
