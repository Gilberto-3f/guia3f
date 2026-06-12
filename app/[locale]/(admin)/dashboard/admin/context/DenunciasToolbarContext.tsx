'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { ContadoresExclusaoCadastro, ContadoresVerificacao } from '../types/admin.types'

export type DenunciasBadgeMap = Partial<Record<'turistas' | 'profissionais' | 'empresas' | 'auditoria', number>>

type Ctx = {
  badgesPendentes: DenunciasBadgeMap
  badgesExclusao: ContadoresExclusaoCadastro
  setBadgesPendentes: (next: DenunciasBadgeMap) => void
  setBadgesExclusao: (next: ContadoresExclusaoCadastro) => void
  /** @deprecated use badgesPendentes */
  badges: DenunciasBadgeMap
  /** @deprecated use setBadgesPendentes */
  setBadges: (next: DenunciasBadgeMap) => void
}

const DenunciasToolbarContext = createContext<Ctx | null>(null)

export function DenunciasToolbarProvider({ children }: { children: ReactNode }) {
  const [badgesPendentes, setBadgesPendentesState] = useState<DenunciasBadgeMap>({})
  const [badgesExclusao, setBadgesExclusaoState] = useState<ContadoresExclusaoCadastro>({
    turistas: 0,
    profissionais: 0,
    empresas: 0,
  })

  const setBadgesPendentes = useCallback((next: DenunciasBadgeMap) => {
    setBadgesPendentesState(next)
  }, [])

  const setBadgesExclusao = useCallback((next: ContadoresExclusaoCadastro) => {
    setBadgesExclusaoState(next)
  }, [])

  const value = useMemo(
    () => ({
      badgesPendentes,
      badgesExclusao,
      setBadgesPendentes,
      setBadgesExclusao,
      badges: badgesPendentes,
      setBadges: setBadgesPendentes,
    }),
    [badgesExclusao, badgesPendentes, setBadgesExclusao, setBadgesPendentes],
  )

  return <DenunciasToolbarContext.Provider value={value}>{children}</DenunciasToolbarContext.Provider>
}

export function useDenunciasToolbar() {
  const ctx = useContext(DenunciasToolbarContext)
  if (!ctx) {
    throw new Error('useDenunciasToolbar must be used within DenunciasToolbarProvider')
  }
  return ctx
}

export type { ContadoresVerificacao }
