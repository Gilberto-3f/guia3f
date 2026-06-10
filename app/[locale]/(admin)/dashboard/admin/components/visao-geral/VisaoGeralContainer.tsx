'use client'

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { PeriodoId } from '../shared/FiltrosPeriodo'
import { FiltroPeriodoCompacto } from '../shared/FiltroPeriodoCompacto'
import { EcossistemaPerfilTabs } from './EcossistemaPerfilTabs'
import type { PerfilVisaoGeral } from '../../types/admin.types'
import { VisaoGeralGraficos } from './VisaoGeralGraficos'

type VisaoGeralCtx = {
  perfil: PerfilVisaoGeral
  setPerfil: (p: PerfilVisaoGeral) => void
  periodo: PeriodoId
  setPeriodo: (p: PeriodoId) => void
}

const Ctx = createContext<VisaoGeralCtx | null>(null)

function useVisaoGeralCtx() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useVisaoGeralCtx deve ser usado dentro de VisaoGeralProvider')
  return ctx
}

export function VisaoGeralProvider({ children }: { children: ReactNode }) {
  const [perfil, setPerfil] = useState<PerfilVisaoGeral>('turistas')
  const [periodo, setPeriodo] = useState<PeriodoId>('30d')
  const value = useMemo(() => ({ perfil, setPerfil, periodo, setPeriodo }), [perfil, periodo])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/** Barra fixa abaixo do cabeçalho azul: cards de navegação + filtro de período. */
export function VisaoGeralBarraFixa() {
  const { perfil, setPerfil, periodo, setPeriodo } = useVisaoGeralCtx()
  return (
    <div className="space-y-2.5 border-t border-gray-100 bg-white px-3 py-2.5 sm:px-4">
      <EcossistemaPerfilTabs value={perfil} onChange={setPerfil} />
      <div className="flex justify-center">
        <FiltroPeriodoCompacto value={periodo} onChange={setPeriodo} />
      </div>
    </div>
  )
}

export function VisaoGeralConteudo() {
  const { perfil, periodo } = useVisaoGeralCtx()
  const filtrosVisao = useMemo(() => ({ periodo }), [periodo])
  return (
    <div className="mt-4">
      <VisaoGeralGraficos perfil={perfil} filtros={filtrosVisao} />
    </div>
  )
}

/** @deprecated Use VisaoGeralProvider + BarraFixa + Conteudo */
export function VisaoGeralContainer() {
  return (
    <VisaoGeralProvider>
      <VisaoGeralBarraFixa />
      <VisaoGeralConteudo />
    </VisaoGeralProvider>
  )
}
