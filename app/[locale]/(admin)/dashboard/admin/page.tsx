'use client'

import { Suspense, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { type AbaPrincipalId, ABAS_PRINCIPAIS } from './components/shared/AbasNavegacao'
import { AdminPastaNav, tituloPastaAdmin } from './components/shared/AdminPastaNav'
import { AdminSubabasRail } from './components/shared/AdminSubabasRail'
import { AdminPermissaoProvider, useSharedAdminGate } from './context/AdminPermissaoContext'
import { DenunciasToolbarProvider } from './context/DenunciasToolbarContext'
import {
  VisaoGeralBarraFixa,
  VisaoGeralConteudo,
  VisaoGeralProvider,
} from './components/visao-geral/VisaoGeralContainer'
import { VerificacaoContainer } from './components/verificacao/VerificacaoContainer'
import { DenunciasContainer } from './components/denuncias/DenunciasContainer'
import { EspacoAdmContainer } from './components/espaco-adm/EspacoAdmContainer'
import { ConfiguracoesContainer } from './components/configuracoes/ConfiguracoesContainer'

function coerceAba(tab: string | null): AbaPrincipalId | null {
  if (!tab) return null
  if ((ABAS_PRINCIPAIS as readonly string[]).includes(tab)) return tab as AbaPrincipalId
  return null
}

function DashboardAdminContent() {
  const router = useRouter()
  const sp = useSearchParams()

  const tab = useMemo(() => coerceAba(sp.get('tab')), [sp])
  const sub = sp.get('sub') ?? ''

  const gate = useSharedAdminGate()

  const setTab = (next: AbaPrincipalId) => {
    const params = new URLSearchParams(sp.toString())
    params.set('tab', next)
    params.delete('sub')
    router.replace(`?${params.toString()}`)
  }

  const voltarPastas = () => {
    const params = new URLSearchParams(sp.toString())
    params.delete('tab')
    params.delete('sub')
    const qs = params.toString()
    router.replace(qs ? `?${qs}` : '?')
  }

  if (gate.status === 'loading') {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-gray-200" />
        <div className="mt-6 h-24 w-full animate-pulse rounded-2xl bg-gray-200" />
        <div className="mt-6 h-80 w-full animate-pulse rounded-2xl bg-gray-200" />
      </div>
    )
  }

  if (gate.status === 'forbidden') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-2xl font-bold text-gray-900">Acesso restrito</h1>
        <p className="mt-2 text-gray-600">Você não tem permissão para acessar a Dashboard Administrativa.</p>
        <div className="mt-6 flex items-center gap-3">
          <Link href="/guia" className="rounded-xl bg-[#0097b2] px-4 py-2 text-sm font-semibold text-white">
            Voltar ao app
          </Link>
          <Link href="/login" className="text-sm font-semibold text-gray-700">
            Ir para login
          </Link>
        </div>
      </div>
    )
  }

  const shell = (
    <DenunciasToolbarProvider>
      <div className="mx-0 max-w-full px-3 pb-10 sm:mx-auto sm:max-w-6xl sm:px-4">
        <div className="sticky top-0 z-20 -mx-3 overflow-hidden shadow-sm sm:-mx-4">
          <div className="bg-[#0097b2] px-3 pb-3 pt-2 text-white sm:px-4 sm:pb-3 sm:pt-2.5">
            <div className="flex items-center justify-between gap-3">
              {tab ? (
                <button
                  type="button"
                  onClick={voltarPastas}
                  aria-label="Voltar às pastas"
                  title="Voltar às pastas"
                  className="inline-flex rounded-full p-2 text-white transition hover:bg-white/15 active:bg-white/25"
                >
                  <ArrowLeft className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
                </button>
              ) : (
                <div className="w-8 sm:w-10" aria-hidden />
              )}
              <span className="flex-1 text-center text-base font-bold uppercase tracking-wide sm:text-lg">
                {tab ? tituloPastaAdmin(tab) : 'Painel Dashboard'}
              </span>
              <Link
                href="/guia"
                aria-label="Voltar ao app"
                title="Voltar ao app"
                className="inline-flex rounded-full p-2 text-white transition hover:bg-white/15 active:bg-white/25"
              >
                <ArrowLeft className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
              </Link>
            </div>
          </div>

          {tab === 'visao-geral' ? <VisaoGeralBarraFixa /> : null}

          {tab && tab !== 'visao-geral' ? (
            <div className="border-t border-gray-100 bg-white px-3 sm:px-4">
              <AdminSubabasRail tab={tab} sub={sub} />
            </div>
          ) : null}
        </div>

        {!tab ? (
          <div className="mt-4">
            <AdminPastaNav onSelect={setTab} />
          </div>
        ) : (
          <div className="mt-4">
            {tab === 'visao-geral' ? (
              <VisaoGeralConteudo />
            ) : tab === 'cadastros' ? (
              <VerificacaoContainer sub={sub} />
            ) : tab === 'denuncias' ? (
              <DenunciasContainer sub={sub} />
            ) : tab === 'espaco-adm' ? (
              <EspacoAdmContainer sub={sub} />
            ) : (
              <ConfiguracoesContainer sub={sub} />
            )}
          </div>
        )}
      </div>
    </DenunciasToolbarProvider>
  )

  if (tab === 'visao-geral') {
    return <VisaoGeralProvider>{shell}</VisaoGeralProvider>
  }

  return shell
}

export default function DashboardAdminPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Carregando...</div>}>
      <AdminPermissaoProvider>
        <DashboardAdminContent />
      </AdminPermissaoProvider>
    </Suspense>
  )
}
