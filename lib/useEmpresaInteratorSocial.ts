'use client'

import { useMemo } from 'react'
import { useAnfitriaoModo } from '@/context/AnfitriaoModoContext'
import { useGuiaModo } from '@/context/GuiaModoContext'
import { useVanModo } from '@/context/VanModoContext'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import { categoriasIncluemAnfitriao } from '@/lib/anfitriaoDualMode'
import { categoriasIncluemGuia } from '@/lib/guiaDualMode'
import { categoriasIncluemVan } from '@/lib/vanDualMode'

/** Empresa vinculada quando o profissional interage no feed em modo empresa (hospedagem ou agência). */
export function useEmpresaInteratorSocial(): string | null {
  const { userRole, profRow } = useProfissionalGate()
  const { ehAnfitriao, modoEfetivo, empresaHospedagemId, empresaHospedagemLiberada } = useAnfitriaoModo()
  const {
    ehGuia,
    modoEfetivo: modoGuiaEfetivo,
    empresaAgenciaId,
    empresaAgenciaLiberada,
  } = useGuiaModo()
  const {
    ehVan,
    modoEfetivo: modoVanEfetivo,
    empresaAgenciaVanId,
    empresaAgenciaVanLiberada,
  } = useVanModo()

  return useMemo(() => {
    if (userRole !== 'profissional') return null

    const prof = profRow as {
      categorias?: string[]
      empresa_hospedagem_id?: string | null
      empresa_agencia_id?: string | null
      empresa_agencia_van_id?: string | null
    } | null

    const ehAnfit = ehAnfitriao || categoriasIncluemAnfitriao(prof?.categorias)
    if (ehAnfit && modoEfetivo === 'hospedagem') {
      const empId =
        String(empresaHospedagemId ?? prof?.empresa_hospedagem_id ?? '').trim() || null
      if (empId && empresaHospedagemLiberada) return empId
    }

    const guia = ehGuia || categoriasIncluemGuia(prof?.categorias)
    if (guia && modoGuiaEfetivo === 'agencia') {
      const empId = String(empresaAgenciaId ?? prof?.empresa_agencia_id ?? '').trim() || null
      if (empId && empresaAgenciaLiberada) return empId
    }

    const van = ehVan || categoriasIncluemVan(prof?.categorias)
    if (van && modoVanEfetivo === 'agencia') {
      const empId = String(empresaAgenciaVanId ?? prof?.empresa_agencia_van_id ?? '').trim() || null
      if (empId && empresaAgenciaVanLiberada) return empId
    }

    return null
  }, [
    userRole,
    profRow,
    ehAnfitriao,
    modoEfetivo,
    empresaHospedagemId,
    empresaHospedagemLiberada,
    ehGuia,
    modoGuiaEfetivo,
    empresaAgenciaId,
    empresaAgenciaLiberada,
    ehVan,
    modoVanEfetivo,
    empresaAgenciaVanId,
    empresaAgenciaVanLiberada,
  ])
}
