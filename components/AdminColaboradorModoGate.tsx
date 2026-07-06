'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { buscarUsuarioCached, invalidarCacheUsuarioSession } from '@/lib/usuarioSessionCache'
import { AdminColaboradorModoProvider } from '@/context/AdminColaboradorModoContext'

export default function AdminColaboradorModoGate({ children }: { children: ReactNode }) {
  const [adminLevel, setAdminLevel] = useState(0)

  const carregar = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.user?.id) {
      setAdminLevel(0)
      return
    }
    const { data } = await buscarUsuarioCached(supabase, session.user.id, 'admin_level')
    const nivel = Number(data?.admin_level ?? 0)
    setAdminLevel(Number.isFinite(nivel) ? nivel : 0)
  }, [])

  useEffect(() => {
    void carregar()
    const onConvite = () => {
      invalidarCacheUsuarioSession()
      void carregar()
    }
    window.addEventListener('admin-convite-respondido', onConvite)
    return () => window.removeEventListener('admin-convite-respondido', onConvite)
  }, [carregar])

  return <AdminColaboradorModoProvider adminLevel={adminLevel}>{children}</AdminColaboradorModoProvider>
}
