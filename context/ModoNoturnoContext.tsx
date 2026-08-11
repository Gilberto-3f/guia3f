'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  aplicarClasseModoNoturno,
  lerModoNoturnoStorage,
  MODO_NOTURNO_STORAGE_KEY,
  salvarModoNoturnoStorage,
} from '@/lib/modoNoturno'

type ModoNoturnoContextValue = {
  modoNoturno: boolean
  setModoNoturno: (ativo: boolean) => void
  toggleModoNoturno: () => void
  /** false até hidratar do localStorage (evita mismatch). */
  pronto: boolean
}

const ModoNoturnoContext = createContext<ModoNoturnoContextValue | null>(null)

export function ModoNoturnoProvider({ children }: { children: ReactNode }) {
  const [modoNoturno, setModoNoturnoState] = useState(false)
  const [pronto, setPronto] = useState(false)

  useEffect(() => {
    const ativo = lerModoNoturnoStorage()
    setModoNoturnoState(ativo)
    aplicarClasseModoNoturno(ativo)
    setPronto(true)

    const onStorage = (e: StorageEvent) => {
      if (e.key !== null && e.key !== MODO_NOTURNO_STORAGE_KEY) return
      const next = lerModoNoturnoStorage()
      setModoNoturnoState(next)
      aplicarClasseModoNoturno(next)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setModoNoturno = useCallback((ativo: boolean) => {
    setModoNoturnoState(ativo)
    salvarModoNoturnoStorage(ativo)
    aplicarClasseModoNoturno(ativo)
  }, [])

  const toggleModoNoturno = useCallback(() => {
    setModoNoturno(!lerModoNoturnoStorage())
  }, [setModoNoturno])

  const value = useMemo(
    () => ({ modoNoturno, setModoNoturno, toggleModoNoturno, pronto }),
    [modoNoturno, setModoNoturno, toggleModoNoturno, pronto],
  )

  return <ModoNoturnoContext.Provider value={value}>{children}</ModoNoturnoContext.Provider>
}

export function useModoNoturno(): ModoNoturnoContextValue {
  const ctx = useContext(ModoNoturnoContext)
  if (!ctx) {
    return {
      modoNoturno: false,
      setModoNoturno: () => {},
      toggleModoNoturno: () => {},
      pronto: false,
    }
  }
  return ctx
}
