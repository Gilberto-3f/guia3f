'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

import ResumoEmpresa from './components/shared/ResumoEmpresa'
import SeletorPeriodo from './components/shared/SeletorPeriodo'
import FunilConversao from './components/funil-conversao/FunilConversao'
import EstatisticasMercado from './components/estatisticas-mercado/EstatisticasMercado'
import DrenaStok from './components/drena-stok/DrenaStok'

type Aba = 'funil' | 'mercado' | 'drena'
type Periodo = '7d' | '30d' | '90d'

type GateState =
  | { status: 'loading' }
  | { status: 'forbidden' }
  | { status: 'allowed'; userId: string }

export default function DashboardEmpresaPage() {
  const router = useRouter()
  const [abaAtiva, setAbaAtiva] = useState<Aba>('funil')
  const [periodo, setPeriodo] = useState<Periodo>('30d')
  const [gate, setGate] = useState<GateState>({ status: 'loading' })

  useEffect(() => {
    let ativo = true

    const boot = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const uid = session?.user?.id ?? null
      if (!uid) {
        if (ativo) setGate({ status: 'forbidden' })
        return
      }

      const { data: urow } = await supabase.from('usuarios').select('role').eq('id', uid).maybeSingle()
      const role = urow?.role != null ? String(urow.role) : null

      if (role !== 'empresa') {
        if (ativo) setGate({ status: 'forbidden' })
        return
      }

      if (ativo) setGate({ status: 'allowed', userId: uid })
    }

    void boot()
    return () => {
      ativo = false
    }
  }, [])

  useEffect(() => {
    if (gate.status !== 'forbidden') return
    router.push('/login')
  }, [gate.status, router])

  const conteudo = useMemo(() => {
    if (abaAtiva === 'funil') return <FunilConversao periodo={periodo} />
    if (abaAtiva === 'mercado') return <EstatisticasMercado periodo={periodo} />
    return <DrenaStok />
  }, [abaAtiva, periodo])

  if (gate.status !== 'allowed') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0097b2]">
        <div className="text-white">{gate.status === 'loading' ? 'Carregando...' : 'Redirecionando...'}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="sticky top-0 z-20 border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <ResumoEmpresa />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6 flex justify-end">
          <SeletorPeriodo value={periodo} onChange={setPeriodo} />
        </div>

        <div className="mb-6 border-b border-gray-200">
          <div className="flex flex-wrap gap-6">
            <button
              type="button"
              onClick={() => setAbaAtiva('funil')}
              className={`pb-3 px-1 text-sm font-medium transition-colors ${
                abaAtiva === 'funil'
                  ? 'text-[#0097b2] border-b-2 border-[#0097b2]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              📈 FUNIL DE CONVERSÃO
            </button>
            <button
              type="button"
              onClick={() => setAbaAtiva('mercado')}
              className={`pb-3 px-1 text-sm font-medium transition-colors ${
                abaAtiva === 'mercado'
                  ? 'text-[#0097b2] border-b-2 border-[#0097b2]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              📊 ESTATÍSTICAS DE MERCADO
            </button>
            <button
              type="button"
              onClick={() => setAbaAtiva('drena')}
              className={`pb-3 px-1 text-sm font-medium transition-colors ${
                abaAtiva === 'drena'
                  ? 'text-[#0097b2] border-b-2 border-[#0097b2]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              📦 DRENA-STOK
            </button>
          </div>
        </div>

        <div>{conteudo}</div>
      </div>
    </div>
  )
}
