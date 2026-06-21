'use client'

import { useMemo, useState } from 'react'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import {
  faseVerificacaoEmpresa,
  faseVerificacaoProfissional,
  faseVerificacaoTurista,
} from '@/lib/faseVerificacaoConta'
import {
  mensagemBloqueioVerificacao,
  TITULO_BLOQUEIO_CONTA,
} from '@/lib/avisoVerificacaoContaTexto'

/**
 * Bloqueia compras/reservas/condicionais do Guia para contas não liberadas.
 * @returns {{
 *   podeComprarReservar: boolean,
 *   avisarBloqueio: () => void,
 *   fecharAvisoBloqueio: () => void,
 *   avisoAberto: boolean,
 *   mensagemBloqueio: string,
 *   tituloBloqueio: string,
 *   faseVerificacao: import('@/lib/faseVerificacaoConta').FaseVerificacaoConta,
 *   loading: boolean,
 * }}
 */
export function useGateComprasReservas() {
  const {
    loading,
    usuarioStatus,
    perfilEhTurista,
    recursosTuristaLiberados,
    perfilEhProfissional,
    recursosProfissionaisLiberados,
    perfilEhEmpresa,
    recursosEmpresaLiberados,
    turistaGate,
    turistaDocsRow,
    profRow,
    empRow,
  } = useProfissionalGate()

  const [avisoAberto, setAvisoAberto] = useState(false)

  const faseVerificacao = useMemo(() => {
    if (perfilEhTurista && !recursosTuristaLiberados) {
      return faseVerificacaoTurista(turistaGate, turistaDocsRow)
    }
    if (perfilEhProfissional && !recursosProfissionaisLiberados) {
      return faseVerificacaoProfissional(usuarioStatus, profRow)
    }
    if (perfilEhEmpresa && !recursosEmpresaLiberados) {
      return faseVerificacaoEmpresa(usuarioStatus, empRow)
    }
    return 'liberado'
  }, [
    perfilEhTurista,
    recursosTuristaLiberados,
    turistaGate,
    turistaDocsRow,
    perfilEhProfissional,
    recursosProfissionaisLiberados,
    perfilEhEmpresa,
    recursosEmpresaLiberados,
    usuarioStatus,
    profRow,
    empRow,
  ])

  const mensagemBloqueio = useMemo(() => {
    if (faseVerificacao === 'liberado') return ''
    const perfil = perfilEhEmpresa ? 'empresa' : perfilEhTurista ? 'turista' : 'profissional'
    return mensagemBloqueioVerificacao(perfil, faseVerificacao)
  }, [faseVerificacao, perfilEhEmpresa, perfilEhTurista])

  const podeComprarReservar =
    !loading &&
    (!perfilEhTurista || recursosTuristaLiberados) &&
    (!perfilEhProfissional || recursosProfissionaisLiberados) &&
    (!perfilEhEmpresa || recursosEmpresaLiberados)

  const avisarBloqueio = () => {
    if (mensagemBloqueio) setAvisoAberto(true)
  }

  return {
    podeComprarReservar,
    avisarBloqueio,
    fecharAvisoBloqueio: () => setAvisoAberto(false),
    avisoAberto,
    mensagemBloqueio,
    tituloBloqueio: TITULO_BLOQUEIO_CONTA,
    faseVerificacao,
    loading,
  }
}
