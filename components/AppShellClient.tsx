'use client'

import { Suspense, useEffect, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { AdminPermissaoProvider } from '@/app/[locale]/(admin)/dashboard/admin/context/AdminPermissaoContext'
import { ModoApresentacaoProvider, useModoApresentacao } from '@/context/ModoApresentacaoContext'
import { ProfissionalGateProvider } from '@/context/ProfissionalGateContext'
import { AnfitriaoModoProvider } from '@/context/AnfitriaoModoContext'
import ModoApresentacaoChrome from '@/components/ModoApresentacaoChrome'
import ProfissionalGateBanner from '@/components/ProfissionalGateBanner'
import BottomBar from '@/components/BottomBar'
import AdminEcossistemaAlertaGate from '@/components/canal/AdminEcossistemaAlertaGate'

/** `feed/criar` emite quando o teclado está visível para esconder a barra (aba TEXTO ou legenda na FOTO). */
const CRIAR_KEYBOARD_EVENT = 'guia-criar-keyboard'

/**
 * Classes e estrutura compartilhadas entre Suspense fallback e conteúdo real.
 * Evita hydration mismatch (#418) quando o fallback divergia (gradiente vs gray-50, chrome ausente).
 */
function shellClasses(pathname: string, tecladoOcultaBarra: boolean) {
  const isStoryCriar = pathname.includes('/feed/story/criar')
  const isCanal = pathname.includes('/canal')
  const isChatAdm = pathname.includes('/chat-adm')
  const telaMensageiro = isCanal || isChatAdm
  const hideBottomBar =
    isStoryCriar || ((pathname.includes('/feed/criar') || telaMensageiro) && tecladoOcultaBarra)
  const paddingInferior = hideBottomBar
    ? ''
    : telaMensageiro
      ? 'pb-14'
      : pathname.includes('/feed/criar')
        ? 'pb-14'
        : 'pb-20'
  const fundoShell =
    pathname.includes('/feed/criar') && !isStoryCriar
      ? 'bg-gradient-to-br from-[#faf8f3] from-[12%] via-white via-[48%] to-stone-300'
      : isStoryCriar
        ? 'bg-black'
        : 'bg-gray-50'
  return { hideBottomBar, paddingInferior, fundoShell }
}

function AppShellLayoutFrame({
  pathname,
  modoAtivo,
  tecladoOcultaBarra,
  children,
}: {
  pathname: string
  modoAtivo: boolean
  tecladoOcultaBarra: boolean
  children: ReactNode
}) {
  const { hideBottomBar, paddingInferior, fundoShell } = shellClasses(pathname, tecladoOcultaBarra)
  const telaMensageiro = pathname.includes('/canal') || pathname.includes('/chat-adm')

  return (
    <div
      className={`flex flex-col ${fundoShell} ${paddingInferior} ${
        telaMensageiro ? 'h-dvh max-h-dvh overflow-hidden' : 'min-h-screen min-h-dvh'
      }`}
    >
      {modoAtivo ? null : <ModoApresentacaoChrome />}
      <ProfissionalGateBanner />
      <AdminEcossistemaAlertaGate />
      <div className={`flex min-h-0 flex-1 flex-col ${telaMensageiro ? 'overflow-hidden' : ''}`}>{children}</div>
      {!hideBottomBar ? <BottomBar /> : null}
    </div>
  )
}

/** Fallback: mesma árvore que o shell em /feed (gray-50, chrome, barra). pathname vazio → defaults de feed. */
function AppShellSuspenseFallback({ children }: { children: ReactNode }) {
  return (
    <AppShellLayoutFrame pathname="" modoAtivo={false} tecladoOcultaBarra={false}>
      {children}
    </AppShellLayoutFrame>
  )
}

function AppShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [tecladoOcultaBarra, setTecladoOcultaBarra] = useState(false)
  const { modoAtivo } = useModoApresentacao()

  useEffect(() => {
    const onKb = (e: Event) => {
      const d = (e as CustomEvent<{ hide?: boolean }>).detail
      setTecladoOcultaBarra(!!d?.hide)
    }
    window.addEventListener(CRIAR_KEYBOARD_EVENT, onKb as EventListener)
    return () => window.removeEventListener(CRIAR_KEYBOARD_EVENT, onKb as EventListener)
  }, [])

  useEffect(() => {
    if (!pathname.includes('/feed/criar') && !pathname.includes('/canal') && !pathname.includes('/chat-adm')) {
      setTecladoOcultaBarra(false)
    }
  }, [pathname])

  return (
    <AppShellLayoutFrame
      pathname={pathname}
      modoAtivo={modoAtivo}
      tecladoOcultaBarra={tecladoOcultaBarra}
    >
      {children}
    </AppShellLayoutFrame>
  )
}

export default function AppShellClient({ children }: { children: ReactNode }) {
  return (
    <AdminPermissaoProvider>
      <ModoApresentacaoProvider>
        <ProfissionalGateProvider>
          <AnfitriaoModoProvider>
            <Suspense fallback={<AppShellSuspenseFallback>{children}</AppShellSuspenseFallback>}>
              <AppShellInner>{children}</AppShellInner>
            </Suspense>
          </AnfitriaoModoProvider>
        </ProfissionalGateProvider>
      </ModoApresentacaoProvider>
    </AdminPermissaoProvider>
  )
}
