'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export type DenunciasBadgeMap = Partial<Record<'turistas' | 'profissionais' | 'empresas', number>>

type Ctx = {
  badges: DenunciasBadgeMap
  setBadges: (next: DenunciasBadgeMap) => void
}

const DenunciasToolbarContext = createContext<Ctx | null>(null)

export function DenunciasToolbarProvider({ children }: { children: ReactNode }) {
  const [badges, setBadgesState] = useState<DenunciasBadgeMap>({})

  const setBadges = useCallback((next: DenunciasBadgeMap) => {
    setBadgesState(next)
  }, [])

  const value = useMemo(() => ({ badges, setBadges }), [badges, setBadges])

  return <DenunciasToolbarContext.Provider value={value}>{children}</DenunciasToolbarContext.Provider>
}

export function useDenunciasToolbar() {
  const ctx = useContext(DenunciasToolbarContext)
  if (!ctx) {
    throw new Error('useDenunciasToolbar must be used within DenunciasToolbarProvider')
  }
  return ctx
}
