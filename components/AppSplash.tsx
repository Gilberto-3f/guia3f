'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { usePathname } from '@/i18n/navigation'
import { lerAppSplashUi, subscribeAppSplashUi } from '@/lib/appSplashReady'

/** Rede travada: não prende o usuário na capa para sempre. */
const SPLASH_MAX_MS = 12_000

function rotaLiberaCapa(pathname: string) {
  if (!pathname) return false
  if (pathname === '/login') return true
  if (pathname === '/escolha-perfil') return true
  if (pathname.startsWith('/cadastro')) return true
  if (pathname.startsWith('/dashboard/admin')) return true
  if (pathname.startsWith('/teste')) return true
  return false
}

/**
 * Capa azul (#0097b2) até a home/shell estar navegável.
 * Sem transform/filter: no iOS um overlay fullscreen deixa véu no cabeçalho.
 */
export function AppSplashCapa() {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0097b2] pt-safe [backdrop-filter:none] [-webkit-backdrop-filter:none]"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Carregando Guia 3F"
    >
      <Image
        src="/logo.png"
        alt="Guia 3F"
        width={220}
        height={80}
        priority
        className="h-auto w-auto max-w-[70vw] object-contain"
      />
    </div>
  )
}

function AppSplashInner() {
  const pathname = usePathname()
  const [ui, setUi] = useState(lerAppSplashUi)
  const [visivel, setVisivel] = useState(true)
  const [estourou, setEstourou] = useState(false)
  const dispensouRef = useRef(false)

  const authLivre = rotaLiberaCapa(pathname)
  const naRaiz = pathname === '/' || pathname === ''
  const chromePronto =
    ui.shellInnerMontado &&
    ui.barraPronta &&
    ui.bootConcluido &&
    ui.ecoCarregou &&
    ui.modosBarraProntos &&
    (ui.homeChromePronto || ui.paginaShellPronta)
  const pronto = authLivre || chromePronto

  useEffect(() => subscribeAppSplashUi(() => setUi(lerAppSplashUi())), [])

  useEffect(() => {
    setEstourou(false)
    if (authLivre || naRaiz) return
    const id = window.setTimeout(() => setEstourou(true), SPLASH_MAX_MS)
    return () => window.clearTimeout(id)
  }, [pathname, authLivre, naRaiz])

  useEffect(() => {
    if (authLivre) {
      dispensouRef.current = false
      setVisivel(false)
      return
    }
    if (naRaiz) {
      dispensouRef.current = false
      setVisivel(true)
      return
    }
    if (dispensouRef.current) {
      setVisivel(false)
      return
    }
    if (!pronto && !estourou) {
      setVisivel(true)
      return
    }
    let inner = 0
    const outer = window.requestAnimationFrame(() => {
      inner = window.requestAnimationFrame(() => {
        dispensouRef.current = true
        setVisivel(false)
      })
    })
    return () => {
      window.cancelAnimationFrame(outer)
      window.cancelAnimationFrame(inner)
    }
  }, [authLivre, naRaiz, pronto, estourou])

  if (!visivel) return null

  return <AppSplashCapa />
}

export default function AppSplash() {
  return (
    <Suspense fallback={null}>
      <AppSplashInner />
    </Suspense>
  )
}
