'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart3, Crown, Filter } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'
import { empresaEhSegmentoLojasParaguai } from '@/lib/cidade-empresa'

import MenuPeriodoDashboard from './components/shared/MenuPeriodoDashboard'
import FunilConversao from './components/funil-conversao/FunilConversao'
import EstatisticasMercado from './components/estatisticas-mercado/EstatisticasMercado'
import DrenaStok from './components/drena-stok/DrenaStok'
import { useDashboardEmpresa } from './hooks/useDashboardEmpresa'
import type { Periodo } from './types/dashboard.types'

type Aba = 'funil' | 'mercado' | 'drena'

type GateState =
  | { status: 'loading' }
  | { status: 'forbidden' }
  | { status: 'pending' }
  | { status: 'sim_sem_empresa' }
  | { status: 'allowed'; userId: string }

function abaCls(ativo: boolean) {
  return `flex flex-none items-center justify-center gap-2 border-b-[3px] px-4 py-3 text-center text-sm font-semibold tracking-wide transition-colors sm:px-5 sm:text-base ${
    ativo ? 'border-[#0097b2] text-[#0097b2]' : 'border-transparent text-gray-500 hover:text-gray-700'
  }`
}

export default function DashboardEmpresaPage() {
  const router = useRouter()
  const [abaAtiva, setAbaAtiva] = useState<Aba>('funil')
  const [periodo, setPeriodo] = useState<Periodo>('30d')
  const [gate, setGate] = useState<GateState>({ status: 'loading' })
  const { modoAtivo, perfilSimulado, contextoEmpresaId } = useModoApresentacao()
  const { dados: empresa } = useDashboardEmpresa()

  const mostrarDrenaStok = useMemo(
    () => empresaEhSegmentoLojasParaguai(empresa?.categoria, empresa?.cidade),
    [empresa?.categoria, empresa?.cidade],
  )

  useEffect(() => {
    if (!mostrarDrenaStok && abaAtiva === 'drena') {
      setAbaAtiva('funil')
    }
  }, [mostrarDrenaStok, abaAtiva])

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
          Não foi possível carregar a empresa de demonstração do modo apresentação. Confirme que a migração da base de dados
          está aplicada, volte ao perfil para escolher o segmento outra vez ou saia do modo apresentação.
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
    <div className="flex min-h-screen flex-col bg-gray-50 pb-16">
      <header className="sticky top-0 z-20 shrink-0 bg-[#0097b2] shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <h1 className="flex items-center gap-2 text-lg font-bold text-white sm:text-xl">
            <Crown className="h-6 w-6 shrink-0 text-white" strokeWidth={2} aria-hidden />
            Dashboard EMPRESA
          </h1>
          <MenuPeriodoDashboard value={periodo} onChange={setPeriodo} />
        </div>

        <div className="border-t border-white/20 bg-white">
          <div className="mx-auto flex max-w-7xl justify-center gap-6 sm:gap-10">
            <button type="button" onClick={() => setAbaAtiva('funil')} className={abaCls(abaAtiva === 'funil')}>
              <Filter className="h-5 w-5 shrink-0 sm:h-[1.35rem] sm:w-[1.35rem]" strokeWidth={2} aria-hidden />
              <span className="flex flex-col items-start gap-0 leading-none">
                <span>Funil de</span>
                <span>conversão</span>
              </span>
            </button>
            <button type="button" onClick={() => setAbaAtiva('mercado')} className={abaCls(abaAtiva === 'mercado')}>
              <BarChart3 className="h-5 w-5 shrink-0 sm:h-[1.35rem] sm:w-[1.35rem]" strokeWidth={2} aria-hidden />
              <span className="flex flex-col items-start gap-0 leading-none">
                <span>estatísticas</span>
                <span>de mercado</span>
              </span>
            </button>
            {mostrarDrenaStok ? (
              <button type="button" onClick={() => setAbaAtiva('drena')} className={abaCls(abaAtiva === 'drena')}>
                Drena-Stok
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-4 pb-2">{conteudo}</main>
    </div>
  )
}
