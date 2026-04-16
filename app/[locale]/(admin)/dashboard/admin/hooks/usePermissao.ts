'use client'

import { useMemo } from 'react'
import { useSharedAdminGate } from '../context/AdminPermissaoContext'

export type { GateState } from './useAdminGate'

export function useAdminPerms() {
  const gate = useSharedAdminGate()
  return useMemo(() => {
    if (gate.status !== 'ok') return null
    return gate.admin
  }, [gate])
}

export function usePermissao() {
  const gate = useSharedAdminGate()
  const admin = gate.status === 'ok' ? gate.admin : null

  const podeExecutarRecurso = useMemo(() => {
    return (recurso: string) => {
      if (!admin) return false
      const raw = admin.admin_permissoes as unknown as { recursos?: string[] }
      const recursos = Array.isArray(raw?.recursos) ? raw.recursos : []
      return recursos.includes('*') || recursos.includes(recurso)
    }
  }, [admin])

  const getComunidade = useMemo(() => {
    return () => {
      if (!admin) return null
      const raw = admin.admin_permissoes as unknown as { comunidade?: string | null }
      return raw?.comunidade ?? null
    }
  }, [admin])

  const nivel = admin?.admin_level ?? 0

  return { admin, nivel, podeExecutarRecurso, getComunidade }
}
