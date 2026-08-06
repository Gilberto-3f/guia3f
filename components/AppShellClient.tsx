'use client'

import { Suspense, useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { AdminPermissaoProvider } from '@/app/[locale]/(admin)/dashboard/admin/context/AdminPermissaoContext'
import { ModoApresentacaoProvider, useModoApresentacao } from '@/context/ModoApresentacaoContext'
import { ProfissionalGateProvider } from '@/context/ProfissionalGateContext'
import { AnfitriaoModoProvider } from '@/context/AnfitriaoModoContext'
import ModoApresentacaoChrome from '@/components/ModoApresentacaoChrome'
import ProfissionalGateBanner from '@/components/ProfissionalGateBanner'
import BottomBar from '@/components/BottomBar'
import AppSplash from '@/components/AppSplash'
import AdminEcossistemaAlertaGate from '@/components/canal/AdminEcossistemaAlertaGate'
import TuristaComprasNotificacaoGate from '@/components/TuristaComprasNotificacaoGate'
import ConviteAdminGate from '@/components/ConviteAdminGate'
import AdminColaboradorModoGate from '@/components/AdminColaboradorModoGate'
import { useAppViewportHeight } from '@/lib/useAppViewportHeight'
import {
  isModalScrollLocked,
  MODAL_SCROLL_LOCK_EVENT,
} from '@/lib/useModalScrollLock'

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
    isStoryCriar ||
    ((pathname.includes('/feed/criar') ||
      telaMensageiro ||
      pathname.includes('/mobilidade') ||
      /\/guia\/?$/.test(pathname)) &&
      tecladoOcultaBarra)
  const isGuiaOuMobilidade =
    /\/guia\/?$/.test(pathname) || pathname.includes('/mobilidade')
  const paddingInferior = hideBottomBar
    ? ''
    : telaMensageiro
      ? 'pb-14'
      : pathname.includes('/feed/criar')
        ? 'pb-14'
        : isGuiaOuMobilidade
          ? '' // mapa até a borda da BottomBar (fixed); sem faixa branca
          : 'pb-20'
  const fundoShell =
    pathname.includes('/feed/criar') && !isStoryCriar
      ? 'bg-gradient-to-br from-[#faf8f3] from-[12%] via-white via-[48%] to-stone-300'
      : isStoryCriar
        ? 'bg-black'
        : 'bg-gray-50'
  return { hideBottomBar, paddingInferior, fundoShell, isGuiaOuMobilidade, telaMensageiro }
}

function AppShellLayoutFrame({
  pathname,
  modoAtivo,
  tecladoOcultaBarra,
  modalOcultaBarra,
  children,
}: {
  pathname: string
  modoAtivo: boolean
  tecladoOcultaBarra: boolean
  modalOcultaBarra: boolean
  children: ReactNode
}) {
  const { hideBottomBar, paddingInferior, fundoShell, isGuiaOuMobilidade, telaMensageiro } =
    shellClasses(pathname, tecladoOcultaBarra)
  const [portalReady] = useState(() => typeof document !== 'undefined')

  useAppViewportHeight()

  // Limpa position:fixed residual de locks antigos (causa faixa sob a barra / drawers).
  useEffect(() => {
    if (typeof document === 'undefined') return
    const softRoute =
      isGuiaOuMobilidade ||
      pathname.includes('/empresa') ||
      pathname.includes('/feed') ||
      pathname.includes('/favoritos') ||
      pathname.includes('/atividades') ||
      pathname.includes('/perfil')
    if (!softRoute) return
    const body = document.body
    if (body.style.position === 'fixed') {
      body.style.position = ''
      body.style.top = ''
      body.style.width = ''
      window.scrollTo(0, 0)
    }
  }, [isGuiaOuMobilidade, pathname, tecladoOcultaBarra, modalOcultaBarra])

  /** Drawer/modal aberto: oculta BottomBar (faixa branca sob hospedagem/produtos). */
  const ocultarBarra = tecladoOcultaBarra || modalOcultaBarra

  const bottomBarPortal =
    isGuiaOuMobilidade || !hideBottomBar ? (
      <div
        className={ocultarBarra ? 'pointer-events-none invisible' : undefined}
        aria-hidden={ocultarBarra || undefined}
      >
        <BottomBar />
      </div>
    ) : null

  return (
    <>
      <AppSplash />
      <div
        className={`flex flex-col ${fundoShell} ${paddingInferior} ${
          telaMensageiro || isGuiaOuMobilidade
            ? 'h-[var(--app-height,100dvh)] max-h-[var(--app-height,100dvh)] overflow-hidden'
            : 'min-h-screen min-h-dvh'
        }`}
      >
        {modoAtivo ? null : <ModoApresentacaoChrome />}
        <ProfissionalGateBanner />
        <AdminEcossistemaAlertaGate />
        <TuristaComprasNotificacaoGate />
        <ConviteAdminGate />
        <div
          className={`flex min-h-0 flex-1 flex-col ${
            telaMensageiro || isGuiaOuMobilidade ? 'overflow-hidden' : ''
          }`}
        >
          {children}
        </div>
      </div>
      {/* Portal no body: evita containing block de ancestors fixed/transform (faixa no iOS). */}
      {portalReady && bottomBarPortal ? createPortal(bottomBarPortal, document.body) : null}
    </>
  )
}

/** Fallback: mesma árvore que o shell em /feed (gray-50, chrome, barra). pathname vazio → defaults de feed. */
function AppShellSuspenseFallback({ children }: { children: ReactNode }) {
  return (
    <AppShellLayoutFrame
      pathname=""
      modoAtivo={false}
      tecladoOcultaBarra={false}
      modalOcultaBarra={false}
    >
      {children}
    </AppShellLayoutFrame>
  )
}

function AppShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [tecladoOcultaBarra, setTecladoOcultaBarra] = useState(false)
  const [modalOcultaBarra, setModalOcultaBarra] = useState(() => isModalScrollLocked())
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
    const onLock = (e: Event) => {
      const d = (e as CustomEvent<{ locked?: boolean }>).detail
      setModalOcultaBarra(!!d?.locked)
    }
    setModalOcultaBarra(isModalScrollLocked())
    window.addEventListener(MODAL_SCROLL_LOCK_EVENT, onLock as EventListener)
    return () => window.removeEventListener(MODAL_SCROLL_LOCK_EVENT, onLock as EventListener)
  }, [])

  useEffect(() => {
    const emTelaTeclado =
      pathname.includes('/feed/criar') ||
      pathname.includes('/canal') ||
      pathname.includes('/chat-adm') ||
      pathname.includes('/mobilidade') ||
      /\/guia\/?$/.test(pathname)
    if (!emTelaTeclado) setTecladoOcultaBarra(false)
  }, [pathname])

  return (
    <AppShellLayoutFrame
      pathname={pathname}
      modoAtivo={modoAtivo}
      tecladoOcultaBarra={tecladoOcultaBarra}
      modalOcultaBarra={modalOcultaBarra}
    >
      {children}
    </AppShellLayoutFrame>
  )
}

export default function AppShellClient({ children }: { children: ReactNode }) {
  return (
    <AdminPermissaoProvider>
      <AdminColaboradorModoGate>
        <ModoApresentacaoProvider>
          <ProfissionalGateProvider>
            <AnfitriaoModoProvider>
              <Suspense fallback={<AppShellSuspenseFallback>{children}</AppShellSuspenseFallback>}>
                <AppShellInner>{children}</AppShellInner>
              </Suspense>
            </AnfitriaoModoProvider>
          </ProfissionalGateProvider>
        </ModoApresentacaoProvider>
      </AdminColaboradorModoGate>
    </AdminPermissaoProvider>
  )
}
