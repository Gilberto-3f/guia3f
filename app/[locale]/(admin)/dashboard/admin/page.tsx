'use client'

import { Suspense, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { AbasNavegacao, type AbaPrincipalId, ABAS_PRINCIPAIS } from './components/shared/AbasNavegacao'
import { AdminSubabasRail } from './components/shared/AdminSubabasRail'
import { TopoCards } from './components/shared/TopoCards'
import { AdminPermissaoProvider, useSharedAdminGate } from './context/AdminPermissaoContext'
import { DenunciasToolbarProvider } from './context/DenunciasToolbarContext'
import { VisaoGeralContainer } from './components/visao-geral/VisaoGeralContainer'
import { VerificacaoContainer } from './components/verificacao/VerificacaoContainer'
import { DenunciasContainer } from './components/denuncias/DenunciasContainer'
import { EspacoAdmContainer } from './components/espaco-adm/EspacoAdmContainer'
import { ConfiguracoesContainer } from './components/configuracoes/ConfiguracoesContainer'

function coerceAba(tab: string | null): AbaPrincipalId {
  if (!tab) return 'visao-geral'
  if ((ABAS_PRINCIPAIS as readonly string[]).includes(tab)) return tab as AbaPrincipalId
  return 'visao-geral'
}

// Componente que usa useSearchParams (precisa estar dentro do Suspense)
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

  return (
    <DenunciasToolbarProvider>
      <div className="mx-auto max-w-6xl px-4 pb-10 pt-1 sm:pt-2">
        <div
          className="sticky top-0 z-20 -mx-4 bg-white px-4 pb-2 pt-1 shadow-sm"
          style={{ willChange: 'transform' }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Link
                href="/guia"
                aria-label="Voltar ao app"
                title="Voltar ao app"
                className="inline-flex rounded-full p-2 text-[#0097b2] transition hover:bg-gray-100 active:bg-gray-200"
              >
                <ArrowLeft className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
              </Link>
              <span className="text-sm font-bold uppercase tracking-wide text-[#0097b2] sm:text-base">
                Painel Dashboard
              </span>
            </div>
          </div>

          <div className="mt-1 border-t border-gray-100 pt-2">
            <TopoCards />
          </div>

          <div className="mt-2 border-t border-gray-100 pt-2">
            <AbasNavegacao value={tab} onChange={setTab} />
          </div>

          <AdminSubabasRail tab={tab} sub={sub} />
        </div>

        <div className="mt-6">
          {tab === 'visao-geral' ? (
            <VisaoGeralContainer sub={sub} />
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
      </div>
    </DenunciasToolbarProvider>
  )
}

// Página principal com Suspense
export default function DashboardAdminPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Carregando...</div>}>
      <AdminPermissaoProvider>
        <DashboardAdminContent />
      </AdminPermissaoProvider>
    </Suspense>
  )
}
