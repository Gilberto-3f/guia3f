'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { empresaRecursosLiberados } from '@/lib/verificacao-documentos'

export type EmpresaMenuGate = 'loading' | 'forbidden' | 'pending' | 'ok'

/**
 * Menu empresa, publicidade, etc.: só após ADM aprovar cadastro (usuario ativo + empresa aprovada + docs).
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
      const [{ data: userData }, { data: empData }] = await Promise.all([
        supabase.from('usuarios').select('role, status').eq('id', uid).maybeSingle(),
        supabase.from('empresas').select('status, docs_verificado').eq('usuario_id', uid).maybeSingle(),
      ])
      const role = userData?.role != null ? String(userData.role) : null
      const st =
        userData && typeof userData === 'object' && 'status' in userData && userData.status != null
          ? String(userData.status)
          : null
      if (role !== 'empresa') {
        if (ativo) setGate('forbidden')
        return
      }
      const empRow =
        empData && typeof empData === 'object'
          ? {
              status: empData.status != null ? String(empData.status) : null,
              docs_verificado: Boolean(empData.docs_verificado),
            }
          : null
      if (!empresaRecursosLiberados(st, empRow)) {
        if (ativo) setGate('pending')
        return
      }
      if (ativo) setGate('ok')
    }
    void boot()

    const onRef = () => void boot()
    window.addEventListener('empresa-gate-refresh', onRef)
    window.addEventListener('perfil-atualizado', onRef)

    return () => {
      ativo = false
      window.removeEventListener('empresa-gate-refresh', onRef)
      window.removeEventListener('perfil-atualizado', onRef)
    }
  }, [])

  useEffect(() => {
    if (gate === 'forbidden') router.push('/login')
  }, [gate, router])

  return gate
}
