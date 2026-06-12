'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ABAS_PRINCIPAIS, type AbaPrincipalId } from '../components/shared/AbasNavegacao'
import { adminHref } from '../utils/adminUrl'

function coerceAba(tab: string | null): AbaPrincipalId | null {
  if (!tab) return null
  if ((ABAS_PRINCIPAIS as readonly string[]).includes(tab)) return tab as AbaPrincipalId
  return null
}

type AdminNavCtx = {
  tab: AbaPrincipalId | null
  sub: string
  selectPasta: (tab: AbaPrincipalId) => void
  selectSub: (tab: AbaPrincipalId, sub: string) => void
  voltarPainel: () => void
}

const Ctx = createContext<AdminNavCtx | null>(null)

export function AdminNavProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()

  const tabFromUrl = sp.get('tab')
  const subFromUrl = sp.get('sub') ?? ''

  const [tab, setTab] = useState<AbaPrincipalId | null>(() => coerceAba(tabFromUrl))
  const [sub, setSub] = useState(subFromUrl)

  const syncUrl = useCallback(
    (nextTab: AbaPrincipalId | null, nextSub: string) => {
      const params = new URLSearchParams()
      if (nextTab) params.set('tab', nextTab)
      if (nextSub) params.set('sub', nextSub)
      router.replace(adminHref(pathname, params), { scroll: false })
    },
    [pathname, router],
  )

  const navigate = useCallback(
    (nextTab: AbaPrincipalId | null, nextSub: string) => {
      setTab(nextTab)
      setSub(nextSub)
      syncUrl(nextTab, nextSub)
    },
    [syncUrl],
  )

  const selectPasta = useCallback(
    (next: AbaPrincipalId) => {
      navigate(next, '')
    },
    [navigate],
  )

  const selectSub = useCallback(
    (nextTab: AbaPrincipalId, nextSub: string) => {
      navigate(nextTab, nextSub)
    },
    [navigate],
  )

  const voltarPainel = useCallback(() => {
    navigate(null, '')
  }, [navigate])

  const value = useMemo(
    () => ({ tab, sub, selectPasta, selectSub, voltarPainel }),
    [tab, sub, selectPasta, selectSub, voltarPainel],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAdminNav() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAdminNav deve ser usado dentro de AdminNavProvider')
  return ctx
}
