'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'

const SPLASH_MIN_MS = 3000
const SESSION_SPLASH_DONE = 'guia_app_splash_done'

/**
 * Capa de abertura (estilo Uber): logo até o gate de perfil estar pronto + mínimo ~3s.
 * Uma vez por sessão do navegador.
 */
export default function AppSplash() {
  const { bootConcluido } = useProfissionalGate()
  const [visivel, setVisivel] = useState(true)
  const [minOk, setMinOk] = useState(false)

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_SPLASH_DONE) === '1') {
        setVisivel(false)
        setMinOk(true)
        return
      }
    } catch {
      /* ignore */
    }
    const id = window.setTimeout(() => setMinOk(true), SPLASH_MIN_MS)
    return () => window.clearTimeout(id)
  }, [])

  useEffect(() => {
    if (!visivel) return
    if (!minOk || !bootConcluido) return
    try {
      sessionStorage.setItem(SESSION_SPLASH_DONE, '1')
    } catch {
      /* ignore */
    }
    setVisivel(false)
  }, [visivel, minOk, bootConcluido])

  if (!visivel) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black"
      style={{ height: 'var(--app-height, 100dvh)' }}
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
