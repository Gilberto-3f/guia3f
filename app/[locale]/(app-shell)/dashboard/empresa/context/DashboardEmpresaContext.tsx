'use client'

import type { ReactNode } from 'react'
import {
  DashboardEmpresaContext,
  useEmpresaState,
  type DadosEmpresa,
} from '../hooks/useDashboardEmpresa'

export function DashboardEmpresaProvider({
  children,
  initialData = null,
}: {
  children: ReactNode
  initialData?: DadosEmpresa | null
}) {
  const value = useEmpresaState(initialData, true)

  return <DashboardEmpresaContext.Provider value={value}>{children}</DashboardEmpresaContext.Provider>
}
