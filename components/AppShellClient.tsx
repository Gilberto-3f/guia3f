'use client'

import { Suspense, useEffect, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { AdminPermissaoProvider } from '@/app/[locale]/(admin)/dashboard/admin/context/AdminPermissaoContext'
import { ModoApresentacaoProvider, useModoApresentacao } from '@/context/ModoApresentacaoContext'
import { ProfissionalGateProvider } from '@/context/ProfissionalGateContext'
import ModoApresentacaoChrome from '@/components/ModoApresentacaoChrome'
import ProfissionalGateBanner from '@/components/ProfissionalGateBanner'
import BottomBar from '@/components/BottomBar'

/** `feed/criar` emite quando o teclado está visível para esconder a barra (aba TEXTO ou legenda na FOTO). */
const CRIAR_KEYBOARD_EVENT = 'guia-criar-keyboard'

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

  const isStoryCriar = pathname.includes('/feed/story/criar')
  const hideBottomBar = isStoryCriar || (pathname.includes('/feed/criar') && criarTecladoOcultaBarra)
  /** `pt-12` era para compensar o `ModoApresentacaoChrome`; sem ele não deve haver espaço extra. */
  const paddingTopoModo = ''

  const paddingInferior =
    hideBottomBar ? '' : pathname.includes('/feed/criar') ? 'pb-14' : 'pb-20'

  const fundoShell =
    pathname.includes('/feed/criar') && !isStoryCriar
      ? 'bg-gradient-to-br from-[#faf8f3] from-[12%] via-white via-[48%] to-stone-300'
      : isStoryCriar
        ? 'bg-black'
        : 'bg-gray-50'

  return (
    <div className={`min-h-screen ${fundoShell} ${paddingTopoModo} ${paddingInferior}`}>
      {modoAtivo ? null : <ModoApresentacaoChrome />}
      {children}
      {!hideBottomBar ? <BottomBar /> : null}
    </div>
  )
}

export default function AppShellClient({ children }: { children: ReactNode }) {
  return (
    <AdminPermissaoProvider>
      <ModoApresentacaoProvider>
        <ProfissionalGateProvider>
          <Suspense
            fallback={
              <div className="min-h-screen bg-gradient-to-br from-[#faf8f3] from-[12%] via-white via-[48%] to-stone-300 pb-20">
                {children}
                <BottomBar />
              </div>
            }
          >
            <AppShellInner>{children}</AppShellInner>
          </Suspense>
        </ProfissionalGateProvider>
      </ModoApresentacaoProvider>
    </AdminPermissaoProvider>
  )
}
