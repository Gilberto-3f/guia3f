'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  alternarAdminColaboradorModo,
  colaboradorTemModoDual,
  gravarAdminColaboradorModo,
  lerAdminColaboradorModo,
  type AdminColaboradorModo,
} from '@/lib/adminColaboradorModo'

type Ctx = {
  modo: AdminColaboradorModo
  emModoAdm: boolean
  emModoUsuario: boolean
  alternar: () => void
  setModo: (m: AdminColaboradorModo) => void
  habilitado: boolean
}

const AdminColaboradorModoContext = createContext<Ctx | null>(null)

export function AdminColaboradorModoProvider({
  adminLevel,
  children,
}: {
  adminLevel: number
  children: ReactNode
}) {
  const habilitado = colaboradorTemModoDual(adminLevel)
  const [modo, setModoState] = useState<AdminColaboradorModo>('adm')

  useEffect(() => {
    if (!habilitado) return
    setModoState(lerAdminColaboradorModo())
    const onChange = (e: Event) => {
      const detail = e instanceof CustomEvent ? (e.detail as { modo?: AdminColaboradorModo }) : null
      if (detail?.modo) setModoState(detail.modo)
      else setModoState(lerAdminColaboradorModo())
    }
    window.addEventListener('admin-colaborador-modo-change', onChange)
    return () => window.removeEventListener('admin-colaborador-modo-change', onChange)
  }, [habilitado])

  const setModo = useCallback(
    (m: AdminColaboradorModo) => {
      if (!habilitado) return
      gravarAdminColaboradorModo(m)
      setModoState(m)
    },
    [habilitado],
  )

  const alternar = useCallback(() => {
    if (!habilitado) return
    const next = alternarAdminColaboradorModo()
    setModoState(next)
  }, [habilitado])

  const value = useMemo(
    () => ({
      modo: habilitado ? modo : 'adm',
      emModoAdm: !habilitado || modo === 'adm',
      emModoUsuario: habilitado && modo === 'usuario',
      alternar,
      setModo,
      habilitado,
    }),
    [alternar, habilitado, modo, setModo],
  )

  return <AdminColaboradorModoContext.Provider value={value}>{children}</AdminColaboradorModoContext.Provider>
}

export function useAdminColaboradorModo(): Ctx {
  const ctx = useContext(AdminColaboradorModoContext)
  if (!ctx) {
    return {
      modo: 'adm',
      emModoAdm: true,
      emModoUsuario: false,
      alternar: () => {},
      setModo: () => {},
      habilitado: false,
    }
  }
  return ctx
}
