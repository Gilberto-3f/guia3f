'use client'

import { useMemo, useState } from 'react'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import {
  faseFeedSocialProfissional,
  faseFeedSocialTurista,
} from '@/lib/faseVerificacaoConta'
import { turistaFeedSocialLiberado } from '@/lib/turistaAcesso'
import {
  mensagemBloqueioFeedSocial,
  TITULO_BLOQUEIO_FEED,
} from '@/lib/avisoVerificacaoContaTexto'

/**
 * Bloqueia interações do feed (comentar, publicar, repostar, compartilhar, avaliar).
 * Curtidas permanecem liberadas. Pré-liberação 24h do turista não libera o feed.
 * @returns {{
 *   podeInteragirFeedSocial: boolean,
 *   avisarBloqueioFeed: () => void,
 *   fecharAvisoBloqueioFeed: () => void,
 *   avisoFeedAberto: boolean,
 *   mensagemBloqueioFeed: string,
 *   tituloBloqueioFeed: string,
 *   faseFeedSocial: import('@/lib/faseVerificacaoConta').FaseVerificacaoConta,
 *   loading: boolean,
 * }}
 */
export function useGateFeedSocial() {
  const {
    loading,
    usuarioStatus,
    perfilEhTurista,
    perfilEhProfissional,
    recursosProfissionaisLiberados,
    turistaGate,
    turistaDocsRow,
    profRow,
  } = useProfissionalGate()

  const [avisoFeedAberto, setAvisoFeedAberto] = useState(false)

  const faseFeedSocial = useMemo(() => {
    if (perfilEhTurista && !turistaFeedSocialLiberado(turistaGate)) {
      return faseFeedSocialTurista(turistaGate, turistaDocsRow)
    }
    if (perfilEhProfissional && !recursosProfissionaisLiberados) {
      return faseFeedSocialProfissional(usuarioStatus, profRow)
    }
    return 'liberado'
  }, [
    perfilEhTurista,
    turistaGate,
    turistaDocsRow,
    perfilEhProfissional,
    recursosProfissionaisLiberados,
    usuarioStatus,
    profRow,
  ])

  const mensagemBloqueioFeed = useMemo(() => {
    if (faseFeedSocial === 'liberado') return ''
    const perfil = perfilEhTurista ? 'turista' : 'profissional'
    return mensagemBloqueioFeedSocial(perfil, faseFeedSocial)
  }, [faseFeedSocial, perfilEhTurista])

  const podeInteragirFeedSocial =
    !loading &&
    (!perfilEhTurista || turistaFeedSocialLiberado(turistaGate)) &&
    (!perfilEhProfissional || recursosProfissionaisLiberados)

  const avisarBloqueioFeed = () => {
    if (mensagemBloqueioFeed) setAvisoFeedAberto(true)
  }

  return {
    podeInteragirFeedSocial,
    avisarBloqueioFeed,
    fecharAvisoBloqueioFeed: () => setAvisoFeedAberto(false),
    avisoFeedAberto,
    mensagemBloqueioFeed,
    tituloBloqueioFeed: TITULO_BLOQUEIO_FEED,
    faseFeedSocial,
    loading,
  }
}
