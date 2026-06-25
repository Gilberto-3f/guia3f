'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'

const EcossistemaAlertaUrgente = dynamic(() => import('@/components/canal/EcossistemaAlertaUrgente'), {
  ssr: false,
})

/** Exibe alertas de socorro apenas para usuários com role admin. */
export default function AdminEcossistemaAlertaGate() {
  const [ehAdmin, setEhAdmin] = useState(false)

  useEffect(() => {
    let ativo = true
    const boot = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const uid = session?.user?.id ?? null
      if (!uid) return
      const { data } = await supabase.from('usuarios').select('role, admin_level').eq('id', uid).maybeSingle()
      const role = data?.role != null ? String(data.role) : ''
      const nivel = Number(data?.admin_level ?? 0)
      if (ativo) setEhAdmin(role === 'admin' || nivel >= 1)
    }
    void boot()
    return () => {
      ativo = false
    }
  }, [])

  if (!ehAdmin) return null
  return <EcossistemaAlertaUrgente />
}
