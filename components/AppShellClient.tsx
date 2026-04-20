'use client'

import { Suspense, useEffect, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { AdminPermissaoProvider } from '@/app/[locale]/(admin)/dashboard/admin/context/AdminPermissaoContext'
import BottomBar from '@/components/BottomBar'

/** `feed/criar` emite quando o teclado está visível para esconder a barra (aba TEXTO ou legenda na FOTO). */
const CRIAR_KEYBOARD_EVENT = 'guia-criar-keyboard'

function AppShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [criarTecladoOcultaBarra, setCriarTecladoOcultaBarra] = useState(false)

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

  const hideBottomBar = pathname.includes('/feed/criar') && criarTecladoOcultaBarra
  /** Em `/feed/criar` menos respiro acima da barra fixa (~1 cm vs `pb-20`; a barra continua igual). */
  const paddingInferior =
    hideBottomBar ? '' : pathname.includes('/feed/criar') ? 'pb-14' : 'pb-20'

  return (
    <div className={`min-h-screen bg-gray-50 ${paddingInferior}`}>
      {children}
      {!hideBottomBar ? <BottomBar /> : null}
    </div>
  )
}

export default function AppShellClient({ children }: { children: ReactNode }) {
  return (
    <AdminPermissaoProvider>
      <Suspense
        fallback={
          <div className="min-h-screen bg-gray-50 pb-20">
            {children}
            <BottomBar />
          </div>
        }
      >
        <AppShellInner>{children}</AppShellInner>
      </Suspense>
    </AdminPermissaoProvider>
  )
}
