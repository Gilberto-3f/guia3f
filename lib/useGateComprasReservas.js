'use client'

import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import { AVISO_TURISTA_ALERTA } from '@/lib/avisoTuristaTexto'
import { AVISO_DOCS_PROF_ALERTA } from '@/lib/avisoDocsProfissionalTexto'

/**
 * Bloqueia compras/reservas/condicionais do Guia para contas não liberadas.
 * @returns {{ podeComprarReservar: boolean, avisarBloqueio: () => void, loading: boolean }}
 */
export function useGateComprasReservas() {
  const {
    loading,
    perfilEhTurista,
    recursosTuristaLiberados,
    perfilEhProfissional,
    recursosProfissionaisLiberados,
  } = useProfissionalGate()

  const podeComprarReservar =
    !loading &&
    (!perfilEhTurista || recursosTuristaLiberados) &&
    (!perfilEhProfissional || recursosProfissionaisLiberados)

  const avisarBloqueio = () => {
    if (perfilEhTurista && !recursosTuristaLiberados) {
      window.alert(AVISO_TURISTA_ALERTA)
      return
    }
    if (perfilEhProfissional && !recursosProfissionaisLiberados) {
      window.alert(AVISO_DOCS_PROF_ALERTA)
    }
  }

  return { podeComprarReservar, avisarBloqueio, loading }
}
