'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'

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
  | { status: 'pending' }
  | { status: 'sim_sem_empresa' }
  | { status: 'allowed'; userId: string }

export default function DashboardEmpresaPage() {
  const router = useRouter()
  const [abaAtiva, setAbaAtiva] = useState<Aba>('funil')
  const [periodo, setPeriodo] = useState<Periodo>('30d')
  const [gate, setGate] = useState<GateState>({ status: 'loading' })
  const { modoAtivo, perfilSimulado, contextoEmpresaId } = useModoApresentacao()

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

      const { data: urow } = await supabase.from('usuarios').select('role, status').eq('id', uid).maybeSingle()
      const role = urow?.role != null ? String(urow.role) : null
      const uStatus =
        urow && typeof urow === 'object' && 'status' in urow && urow.status != null
          ? String(urow.status)
          : 'ativo'

      if (role === 'admin' && modoAtivo && perfilSimulado?.tipo === 'empresa') {
        if (contextoEmpresaId) {
          if (ativo) setGate({ status: 'allowed', userId: uid })
        } else if (ativo) {
          setGate({ status: 'sim_sem_empresa' })
        }
        return
      }

      if (role !== 'empresa') {
        if (ativo) setGate({ status: 'forbidden' })
        return
      }

      if (uStatus !== 'ativo') {
        if (ativo) setGate({ status: 'pending' })
        return
      }

      if (ativo) setGate({ status: 'allowed', userId: uid })
    }

    void boot()
    return () => {
      ativo = false
    }
  }, [modoAtivo, perfilSimulado?.tipo, contextoEmpresaId])

  useEffect(() => {
    if (gate.status === 'forbidden') router.push('/login')
  }, [gate.status, router])

  const conteudo = useMemo(() => {
    if (abaAtiva === 'funil') return <FunilConversao periodo={periodo} />
    if (abaAtiva === 'mercado') return <EstatisticasMercado periodo={periodo} />
    return <DrenaStok />
  }, [abaAtiva, periodo])

  if (gate.status === 'pending') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 p-6 text-center">
        <p className="max-w-md text-[#001f3f]">
          O painel da empresa fica disponível após a aprovação do administrador. Enquanto isso, use o app como guia
          turístico.
        </p>
        <Link
          href="/guia"
          className="rounded-full bg-[#0097b2] px-6 py-3 font-semibold text-white hover:opacity-95"
        >
          Ir para o guia
        </Link>
      </div>
    )
  }

  if (gate.status === 'sim_sem_empresa') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 p-6 text-center">
        <p className="max-w-md text-[#001f3f]">
          Não foi encontrada uma empresa real neste segmento para pré-visualizar o painel. Experimente outro segmento ou saia
          do modo apresentação.
        </p>
        <Link
          href="/guia"
          className="rounded-full bg-[#0097b2] px-6 py-3 font-semibold text-white hover:opacity-95"
        >
          Ir para o guia
        </Link>
      </div>
    )
  }

  if (gate.status !== 'allowed') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0097b2]">
        <div className="text-white">
          {gate.status === 'loading' ? 'Carregando...' : 'Redirecionando...'}
        </div>
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
