'use client'

import { useMemo } from 'react'
import { useAnfitriaoModo } from '@/context/AnfitriaoModoContext'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import { profissionalOperaComoEmpresaHospedagem } from '@/lib/anfitriaoDualMode'

/** Empresa de hospedagem quando o anfitrião interage no feed em modo hospedagem. */
export function useEmpresaInteratorSocial(): string | null {
  const { userRole } = useProfissionalGate()
  const { ehAnfitriao, modoEfetivo, empresaHospedagemId, empresaHospedagemLiberada } = useAnfitriaoModo()

  return useMemo(
    () =>
      profissionalOperaComoEmpresaHospedagem(
        userRole,
        ehAnfitriao,
        modoEfetivo,
        empresaHospedagemId,
        empresaHospedagemLiberada,
      )
        ? String(empresaHospedagemId ?? '').trim() || null
        : null,
    [userRole, ehAnfitriao, modoEfetivo, empresaHospedagemId, empresaHospedagemLiberada],
  )
}
