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

  const isStoryCriar = pathname.includes('/feed/story/criar')
  const hideBottomBar = isStoryCriar || (pathname.includes('/feed/criar') && criarTecladoOcultaBarra)
  /** Em `/feed/criar` menos respiro acima da barra fixa; em criar story o editor tem rodapé próprio. */
  const paddingInferior =
    hideBottomBar ? '' : pathname.includes('/feed/criar') ? 'pb-14' : 'pb-20'

  const fundoShell =
    pathname.includes('/feed/criar') && !isStoryCriar
      ? 'bg-gradient-to-br from-[#faf8f3] from-[12%] via-white via-[48%] to-stone-300'
      : isStoryCriar
        ? 'bg-black'
        : 'bg-gray-50'

  return (
    <div className={`min-h-screen ${fundoShell} ${paddingInferior}`}>
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
          <div className="min-h-screen bg-gradient-to-br from-[#faf8f3] from-[12%] via-white via-[48%] to-stone-300 pb-20">
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
