'use client'

import { useMemo } from 'react'
import { useAnfitriaoModo } from '@/context/AnfitriaoModoContext'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import { categoriasIncluemAnfitriao } from '@/lib/anfitriaoDualMode'

/** Empresa de hospedagem quando o anfitrião interage no feed em modo hospedagem. */
export function useEmpresaInteratorSocial(): string | null {
  const { userRole, profRow } = useProfissionalGate()
  const { ehAnfitriao, modoEfetivo, empresaHospedagemId, empresaHospedagemLiberada } = useAnfitriaoModo()

  return useMemo(() => {
    if (userRole !== 'profissional') return null

    const prof = profRow as { categorias?: string[]; empresa_hospedagem_id?: string | null } | null
    const ehAnfit =
      ehAnfitriao || categoriasIncluemAnfitriao(prof?.categorias)
    if (!ehAnfit) return null

    const empId =
      String(empresaHospedagemId ?? prof?.empresa_hospedagem_id ?? '').trim() || null
    if (!empId || !empresaHospedagemLiberada) return null

    // Única fonte de verdade: modo efetivo do contexto (já sincronizado com localStorage).
    if (modoEfetivo === 'hospedagem') return empId

    return null
  }, [userRole, profRow, ehAnfitriao, modoEfetivo, empresaHospedagemId, empresaHospedagemLiberada])
}
