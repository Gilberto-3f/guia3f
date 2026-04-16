'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { GateState } from '../hooks/useAdminGate'
import { useAdminGate } from '../hooks/useAdminGate'

const AdminGateContext = createContext<GateState | null>(null)

export function AdminPermissaoProvider({ children }: { children: ReactNode }) {
  const gate = useAdminGate()
  return <AdminGateContext.Provider value={gate}>{children}</AdminGateContext.Provider>
}

/** Estado do gate compartilhado (uma sessão / um fetch por árvore). Exige `AdminPermissaoProvider`. */
export function useSharedAdminGate(): GateState {
  const gate = useContext(AdminGateContext)
  if (gate === null) {
    throw new Error('useSharedAdminGate deve ser usado dentro de AdminPermissaoProvider')
  }
  return gate
}
