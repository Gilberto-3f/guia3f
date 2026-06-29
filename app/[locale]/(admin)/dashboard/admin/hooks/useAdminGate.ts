'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { AdminPermissoes, AdminUser } from '../types/admin.types'

export type GateState =
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

/** Uma única instância por árvore — use via `AdminPermissaoProvider` + `useSharedAdminGate`. */
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
        .select('id, role, admin_level, email, username, admin_permissoes, status')
        .eq('id', uid)
        .maybeSingle()

      if (error || !u) {
        if (alive) setState({ status: 'forbidden' })
        return
      }

      const roleStr = String(u.role ?? '')
      const nivelDb = parseAdminLevel(u.admin_level)
      const podeAcessarDashboard = roleStr === 'admin' || nivelDb >= 1

      if (!podeAcessarDashboard) {
        if (alive) setState({ status: 'forbidden' })
        return
      }

      const email = (u as { email?: string | null }).email ?? null
      const username = (u as { username?: string | null }).username ?? null
      const nivel = coerceNivel((u as { admin_level?: unknown }).admin_level)
      const permsRaw = (u as { admin_permissoes?: unknown }).admin_permissoes

      const admin: AdminUser = {
        id: String(u.id),
        role: 'admin',
        admin_level: nivel,
        admin_permissoes:
          permsRaw && typeof permsRaw === 'object'
            ? (permsRaw as AdminUser['admin_permissoes'])
            : {
                recursos: nivel === 1 ? ['*'] : [],
                nivel,
                cargo: nivel === 1 ? 'ADM_GERAL' : undefined,
                modulos: nivel === 1 ? ['*'] : [],
                comunidade: null,
              },
        username: username?.replace(/^@+/, '') ?? email?.split('@')[0] ?? null,
        email,
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
