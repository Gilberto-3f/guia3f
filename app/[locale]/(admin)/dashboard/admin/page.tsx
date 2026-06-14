'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { AdminPastaNav, pastaAdminPorId, tituloPastaAdmin } from './components/shared/AdminPastaNav'
import { TopoCardsResumo } from './components/shared/TopoCards'
import { AdminSubabasRail } from './components/shared/AdminSubabasRail'
import { AdminPermissaoProvider, useSharedAdminGate } from './context/AdminPermissaoContext'
import { AdminNavProvider, useAdminNav } from './context/AdminNavContext'
import { DenunciasToolbarProvider } from './context/DenunciasToolbarContext'
import {
  VisaoGeralBarraFixa,
  VisaoGeralConteudo,
  VisaoGeralProvider,
} from './components/visao-geral/VisaoGeralContainer'
import { CadastrosBarraFixa } from './components/verificacao/CadastrosBarraFixa'
import { VerificacaoContainer } from './components/verificacao/VerificacaoContainer'
import { DenunciasContainer } from './components/denuncias/DenunciasContainer'
import { EspacoAdmContainer } from './components/espaco-adm/EspacoAdmContainer'
import { EspacoAdmBarraFixa } from './components/espaco-adm/EspacoAdmBarraFixa'
import { ConfiguracoesContainer } from './components/configuracoes/ConfiguracoesContainer'
import {
  ServicosTabeladosBarraFixa,
  ServicosTabeladosConteudo,
  ServicosTabeladosProvider,
} from './components/servicos-tabelados/ServicosTabeladosContainer'
import { useCadastrosContadores } from './hooks/useCadastrosContadores'
import { useDenunciasContadores } from './hooks/useDenunciasContadores'
import { useComissaoOfertaContadores } from './hooks/useComissaoOfertaContadores'
import { isAdmGeral } from './utils/permissoes'

function DashboardAdminContent() {
  const { tab, sub, selectPasta, voltarPainel } = useAdminNav()

  const gate = useSharedAdminGate()
  const cadastrosContadores = useCadastrosContadores(!tab || tab === 'cadastros')
  const denunciasContadores = useDenunciasContadores(!tab || tab === 'denuncias')
  const comissaoContadores = useComissaoOfertaContadores(!tab || tab === 'espaco-adm')
  const mostrarBadgeExclusao =
    gate.status === 'ok' && isAdmGeral(gate.admin)

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

  const pastaAtiva = tab ? pastaAdminPorId(tab) : null

  const shell = (
    <DenunciasToolbarProvider>
      <div className="mx-0 max-w-full px-3 pb-10 sm:mx-auto sm:max-w-6xl sm:px-4">
        <div className="sticky top-0 z-20 -mx-3 overflow-hidden shadow-sm sm:-mx-4">
          <div className="bg-[#0097b2] px-3 pb-3 pt-2 text-white sm:px-4 sm:pb-3 sm:pt-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="w-8 sm:w-10" aria-hidden />
              {pastaAtiva ? (
                <span className="flex flex-1 items-center justify-center gap-2 text-center text-base font-bold uppercase tracking-wide sm:text-lg">
                  <pastaAtiva.Icon className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" strokeWidth={2.25} aria-hidden />
                  <span>{tituloPastaAdmin(tab!)}</span>
                </span>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center text-center leading-tight">
                  <span className="text-base font-bold uppercase tracking-wide sm:text-lg">Dashboard ADM</span>
                  <span className="mt-0.5 text-[11px] font-normal normal-case text-white/90 sm:text-xs">
                    Painel Administrativo
                  </span>
                </div>
              )}
              {tab ? (
                <button
                  type="button"
                  onClick={voltarPainel}
                  aria-label="Voltar ao painel"
                  title="Voltar ao painel"
                  className="inline-flex rounded-full p-2 text-white transition hover:bg-white/15 active:bg-white/25"
                >
                  <ArrowLeft className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
                </button>
              ) : (
                <Link
                  href="/guia"
                  aria-label="Voltar ao app"
                  title="Voltar ao app"
                  className="inline-flex rounded-full p-2 text-white transition hover:bg-white/15 active:bg-white/25"
                >
                  <ArrowLeft className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
                </Link>
              )}
            </div>
          </div>

          {!tab ? (
            <div className="border-t border-gray-100 bg-white px-3 py-3 sm:px-4 sm:py-4">
              <TopoCardsResumo />
              <p className="mt-2 text-center text-xs font-medium text-[#0097b2]">Visão Geral</p>
            </div>
          ) : null}

          {tab === 'visao-geral' ? <VisaoGeralBarraFixa /> : null}

          {tab === 'cadastros' ? <CadastrosBarraFixa sub={sub} /> : null}

          {tab === 'espaco-adm' ? (
            <EspacoAdmBarraFixa sub={sub} beneficiosPendentes={comissaoContadores.pendentes} />
          ) : null}

          {tab === 'servicos-tabelados' ? <ServicosTabeladosBarraFixa /> : null}

          {tab && tab !== 'visao-geral' && tab !== 'cadastros' && tab !== 'espaco-adm' && tab !== 'servicos-tabelados' ? (
            <div className="border-t border-gray-100 bg-white px-3 sm:px-4">
              <AdminSubabasRail tab={tab} sub={sub} />
            </div>
          ) : null}
        </div>

        {!tab ? (
          <div className="mt-4">
            <AdminPastaNav
              onSelect={selectPasta}
              cadastrosVerificacoes={cadastrosContadores.totalVerificacoes}
              cadastrosExclusoes={cadastrosContadores.totalExclusoes}
              mostrarBadgeExclusaoCadastros={mostrarBadgeExclusao}
              denunciasPendentes={denunciasContadores.totalPendentes}
              denunciasExclusoes={denunciasContadores.totalExclusoes}
              mostrarBadgeExclusaoDenuncias={mostrarBadgeExclusao}
              espacoAdmBeneficios={comissaoContadores.pendentes}
            />
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
            ) : tab === 'servicos-tabelados' ? (
              <ServicosTabeladosConteudo />
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

  if (tab === 'servicos-tabelados') {
    return <ServicosTabeladosProvider>{shell}</ServicosTabeladosProvider>
  }

  return shell
}

export default function DashboardAdminPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Carregando...</div>}>
      <AdminPermissaoProvider>
        <AdminNavProvider>
          <DashboardAdminContent />
        </AdminNavProvider>
      </AdminPermissaoProvider>
    </Suspense>
  )
}
