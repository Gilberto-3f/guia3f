'use client'

import { useMemo } from 'react'
import { useSharedAdminGate } from '../context/AdminPermissaoContext'
import { isAdmGeral } from '../utils/permissoes'

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
      if (isAdmGeral(admin)) return true
      const raw = admin.admin_permissoes as unknown as { recursos?: string[] }
      const recursos = Array.isArray(raw?.recursos) ? raw.recursos : []
      if (recursos.length === 0) return true
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

  const getPais = useMemo(() => {
    return () => {
      if (!admin) return null
      const raw = admin.admin_permissoes as unknown as { pais?: string | null }
      const p = raw?.pais != null ? String(raw.pais).trim().toUpperCase() : ''
      return p || null
    }
  }, [admin])

  const nivel = admin?.admin_level ?? 0

  return { admin, nivel, podeExecutarRecurso, getComunidade, getPais }
}
