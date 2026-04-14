'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { AdminPermissoes, AdminUser } from '../types/admin.types'
import { withDefaultsAdminPerms } from '../utils/permissoes'

type GateState =
  | { status: 'loading' }
  | { status: 'forbidden' }
  | { status: 'ok'; admin: AdminUser }

function parseAdminLevel(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function coerceNivel(v: unknown): AdminUser['admin_level'] {
  const n = parseAdminLevel(v)
  if (n === 1 || n === 2 || n === 3 || n === 4) return n
  return 0
}

function coercePerms(v: unknown): AdminPermissoes {
  return withDefaultsAdminPerms(v)
}

export function useAdminGate(): GateState {
  const [state, setState] = useState<GateState>({ status: 'loading' })

  useEffect(() => {
    let alive = true

    const run = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const uid = session?.user?.id
      if (!uid) {
        if (alive) setState({ status: 'forbidden' })
        return
      }

      const { data: u, error } = await supabase
        .from('usuarios')
        .select('id, role, admin_level, admin_permissoes, username, email')
        .eq('id', uid)
        .maybeSingle()

      if (error || !u) {
        if (alive) setState({ status: 'forbidden' })
        return
      }

      const roleStr = String(u.role ?? '')
      const nivelDb = parseAdminLevel(u.admin_level)
      /** `role = admin` (seed) OU `admin_level` 1–4 (evita bloqueio se só o nível foi ajustado no Supabase). */
      const podeAcessarDashboard = roleStr === 'admin' || (nivelDb >= 1 && nivelDb <= 4)

      if (!podeAcessarDashboard) {
        if (alive) setState({ status: 'forbidden' })
        return
      }

      const admin: AdminUser = {
        id: String(u.id),
        role: 'admin',
        admin_level: coerceNivel((u as { admin_level?: unknown }).admin_level),
        admin_permissoes: coercePerms((u as { admin_permissoes?: unknown }).admin_permissoes),
        username: (u as { username?: string | null }).username ?? null,
        email: (u as { email?: string | null }).email ?? null,
      }

      if (alive) setState({ status: 'ok', admin })
    }

    void run()
    return () => {
      alive = false
    }
  }, [])

  return state
}

export function useAdminPerms() {
  const gate = useAdminGate()
  return useMemo(() => {
    if (gate.status !== 'ok') return null
    return gate.admin
  }, [gate])
}

export function usePermissao() {
  const gate = useAdminGate()
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

