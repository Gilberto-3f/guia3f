'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { empresaContaOperacional } from '@/lib/accessGates'

export type EmpresaMenuGate = 'loading' | 'forbidden' | 'pending' | 'ok'

/**
 * Menu empresa, publicidade, Drena-Stok (via menu): só com usuarios.status = ativo (após ADM).
 */
export function useEmpresaMenuGate(): EmpresaMenuGate {
  const router = useRouter()
  const [gate, setGate] = useState<EmpresaMenuGate>('loading')

  useEffect(() => {
    let ativo = true
    const boot = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const uid = session?.user?.id ?? null
      if (!uid) {
        if (ativo) setGate('forbidden')
        return
      }
      const { data } = await supabase.from('usuarios').select('role, status').eq('id', uid).maybeSingle()
      const role = data?.role != null ? String(data.role) : null
      const st = data && typeof data === 'object' && 'status' in data && data.status != null ? String(data.status) : null
      if (role !== 'empresa') {
        if (ativo) setGate('forbidden')
        return
      }
      if (!empresaContaOperacional(st)) {
        if (ativo) setGate('pending')
        return
      }
      if (ativo) setGate('ok')
    }
    void boot()
    return () => {
      ativo = false
    }
  }, [])

  useEffect(() => {
    if (gate === 'forbidden') router.push('/login')
  }, [gate, router])

  return gate
}
