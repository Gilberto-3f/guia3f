'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useDashboardEmpresa } from '../../../dashboard/empresa/hooks/useDashboardEmpresa'
import MenuLateralEmpresa from '../../components/menu-empresa/MenuLateralEmpresa'
import Publicidade from '../../components/menu-empresa/Publicidade'

export default function PublicidadePage() {
  const router = useRouter()
  const { dados: empresaDados } = useDashboardEmpresa()
  const [gate, setGate] = useState<'loading' | 'forbidden' | 'ok'>('loading')
  const [menuAberto, setMenuAberto] = useState(false)

  const voltarParaEmpresa = () => {
    if (empresaDados?.id) {
      router.push(`/empresa/${empresaDados.id}`)
      return
    }
    router.back()
  }

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
      const { data } = await supabase.from('usuarios').select('role').eq('id', uid).maybeSingle()
      const role = data?.role != null ? String(data.role) : null
      if (role !== 'empresa') {
        if (ativo) setGate('forbidden')
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
    if (gate !== 'forbidden') return
    router.push('/login')
  }, [gate, router])

  if (gate !== 'ok') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0097b2]">
        <div className="text-white">{gate === 'loading' ? 'Carregando...' : 'Redirecionando...'}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="sticky top-0 z-20 border-b bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-4">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            <button
              type="button"
              onClick={() => voltarParaEmpresa()}
              className="-ml-1 mt-0.5 shrink-0 rounded-lg p-2 text-gray-600 hover:bg-gray-100"
              aria-label="Voltar"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold text-[#001f3f]">Publicidade</h1>
              <p className="truncate text-xs text-gray-500">Menu Empresa</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMenuAberto(true)}
            className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
          >
            🏢 Menu
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6">
        <Publicidade />
      </div>

      <MenuLateralEmpresa aberto={menuAberto} onClose={() => setMenuAberto(false)} />
    </div>
  )
}

