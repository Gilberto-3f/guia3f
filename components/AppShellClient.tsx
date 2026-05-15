'use client'

import { Suspense, useEffect, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { AdminPermissaoProvider } from '@/app/[locale]/(admin)/dashboard/admin/context/AdminPermissaoContext'
import { ModoApresentacaoProvider, useModoApresentacao } from '@/context/ModoApresentacaoContext'
import { ProfissionalGateProvider } from '@/context/ProfissionalGateContext'
import ModoApresentacaoChrome from '@/components/ModoApresentacaoChrome'
import BottomBar from '@/components/BottomBar'

/** `feed/criar` emite quando o teclado está visível para esconder a barra (aba TEXTO ou legenda na FOTO). */
const CRIAR_KEYBOARD_EVENT = 'guia-criar-keyboard'

/**
 * Classes e estrutura compartilhadas entre Suspense fallback e conteúdo real.
 * Evita hydration mismatch (#418) quando o fallback divergia (gradiente vs gray-50, chrome ausente).
 */
function shellClasses(pathname: string, criarTecladoOcultaBarra: boolean) {
  const isStoryCriar = pathname.includes('/feed/story/criar')
  const hideBottomBar = isStoryCriar || (pathname.includes('/feed/criar') && criarTecladoOcultaBarra)
  const paddingInferior = hideBottomBar ? '' : pathname.includes('/feed/criar') ? 'pb-14' : 'pb-20'
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
  criarTecladoOcultaBarra,
  children,
}: {
  pathname: string
  modoAtivo: boolean
  criarTecladoOcultaBarra: boolean
  children: ReactNode
}) {
  const { hideBottomBar, paddingInferior, fundoShell } = shellClasses(pathname, criarTecladoOcultaBarra)

  return (
    <div className={`flex min-h-screen min-h-dvh flex-col ${fundoShell} ${paddingInferior}`}>
      {modoAtivo ? null : <ModoApresentacaoChrome />}
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      {!hideBottomBar ? <BottomBar /> : null}
    </div>
  )
}

/** Fallback: mesma árvore que o shell em /feed (gray-50, chrome, barra). pathname vazio → defaults de feed. */
function AppShellSuspenseFallback({ children }: { children: ReactNode }) {
  return (
    <AppShellLayoutFrame pathname="" modoAtivo={false} criarTecladoOcultaBarra={false}>
      {children}
    </AppShellLayoutFrame>
  )
}

function AppShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [criarTecladoOcultaBarra, setCriarTecladoOcultaBarra] = useState(false)
  const { modoAtivo } = useModoApresentacao()

  useEffect(() => {
    const onKb = (e: Event) => {
      const d = (e as CustomEvent<{ hide?: boolean }>).detail
      setCriarTecladoOcultaBarra(!!d?.hide)
    }
    window.addEventListener(CRIAR_KEYBOARD_EVENT, onKb as EventListener)
    return () => window.removeEventListener(CRIAR_KEYBOARD_EVENT, onKb as EventListener)
  }, [])

  useEffect(() => {
    if (!pathname.includes('/feed/criar')) setCriarTecladoOcultaBarra(false)
  }, [pathname])

  return (
    <AppShellLayoutFrame
      pathname={pathname}
      modoAtivo={modoAtivo}
      criarTecladoOcultaBarra={criarTecladoOcultaBarra}
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
          <Suspense fallback={<AppShellSuspenseFallback>{children}</AppShellSuspenseFallback>}>
            <AppShellInner>{children}</AppShellInner>
          </Suspense>
        </ProfissionalGateProvider>
      </ModoApresentacaoProvider>
    </AdminPermissaoProvider>
  )
}
