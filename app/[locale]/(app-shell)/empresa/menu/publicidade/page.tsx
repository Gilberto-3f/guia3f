'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useDashboardEmpresa } from '../../../dashboard/empresa/hooks/useDashboardEmpresa'
import Publicidade from '../../components/menu-empresa/Publicidade'

export default function PublicidadePage() {
  const router = useRouter()
  const { dados: empresaDados } = useDashboardEmpresa()
  const [gate, setGate] = useState<'loading' | 'forbidden' | 'ok'>('loading')

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

  const corpo =
    gate === 'ok' ? (
      <Publicidade />
    ) : gate === 'forbidden' ? (
      <div className="py-10 text-center text-sm text-gray-500">A redirecionar…</div>
    ) : (
      <div className="space-y-4 pt-4" aria-busy="true" aria-label="A carregar">
        <div className="h-11 animate-pulse rounded-lg bg-gray-200" />
        <div className="h-44 animate-pulse rounded-lg bg-gray-200 sm:h-52" />
        <div className="h-32 animate-pulse rounded-lg bg-gray-200" />
      </div>
    )

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="sticky top-0 z-20 border-b border-white/15 bg-[#0097b2]">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-4">
          <button
            type="button"
            onClick={() => voltarParaEmpresa()}
            className="-ml-1 shrink-0 rounded-lg p-2 text-white hover:bg-white/15"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-white">Publicidade</h1>
            <p className="truncate text-xs text-white/80">Menu Empresa</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 pb-6 pt-0">{corpo}</div>
    </div>
  )
}
