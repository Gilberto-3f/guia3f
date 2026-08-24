'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { MessageCircle, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import ChatCorridaMobilidade from '@/components/mobilidade/ChatCorridaMobilidade'
import { useModalScrollLock } from '@/lib/useModalScrollLock'
import { refreshAppViewportHeight } from '@/lib/useAppViewportHeight'
import { propsUmToque } from '@/lib/umToque'

const COR = '#0097b2'

type Msg = {
  remetente_id: string
  created_at: string
}

type Props = {
  aberto: boolean
  conversaId: string
  onFechar: () => void
  onMensagensChange?: (msgs: Msg[], meuId: string | null) => void
  headerCor?: string
}

function caixaVisualViewport(): { top: number; height: number } {
  const vv = window.visualViewport
  if (!vv) {
    return { top: 0, height: Math.round(window.innerHeight) }
  }
  return { top: Math.round(vv.offsetTop), height: Math.max(200, Math.round(vv.height)) }
}

/** Drawer full-screen da troca de mensagens da corrida (turista e profissional). */
export default function DrawerChatCorridaMobilidade({
  aberto,
  conversaId,
  onFechar,
  onMensagensChange,
  headerCor = COR,
}: Props) {
  const t = useTranslations('Mobilidade')
  useModalScrollLock(aberto)
  const raizRef = useRef<HTMLDivElement | null>(null)
  const cabecalhoRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!aberto) return
    const aplicar = () => {
      refreshAppViewportHeight()
      const el = raizRef.current
      if (!el) return
      const { top, height } = caixaVisualViewport()
      el.style.top = `${top}px`
      el.style.height = `${height}px`
      cabecalhoRef.current?.classList.toggle('pt-safe', top === 0)
    }
    aplicar()
    window.visualViewport?.addEventListener('resize', aplicar)
    window.visualViewport?.addEventListener('scroll', aplicar)
    window.addEventListener('resize', aplicar)
    return () => {
      window.visualViewport?.removeEventListener('resize', aplicar)
      window.visualViewport?.removeEventListener('scroll', aplicar)
      window.removeEventListener('resize', aplicar)
    }
  }, [aberto])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      ref={raizRef}
      className={
        aberto
          ? 'fixed left-0 right-0 z-[90] flex flex-col overflow-hidden bg-white touch-manipulation'
          : 'hidden'
      }
      style={
        aberto ? { top: 0, height: 'var(--app-height, 100dvh)' } : undefined
      }
      role="dialog"
      aria-modal={aberto}
      aria-hidden={!aberto}
      aria-labelledby="drawer-chat-corrida-titulo"
      data-modal-scroll-lock-scrollable
    >
      <div
        ref={cabecalhoRef}
        className="shrink-0 pt-safe"
        style={{ backgroundColor: headerCor }}
      >
        <div className="flex h-12 items-center gap-2 px-3">
          <MessageCircle className="h-5 w-5 shrink-0 text-white" aria-hidden strokeWidth={2.25} />
          <h2
            id="drawer-chat-corrida-titulo"
            className="min-w-0 flex-1 truncate text-base font-bold uppercase tracking-wide text-white"
          >
            {t('chatTitulo')}
          </h2>
          <button
            type="button"
            {...propsUmToque(onFechar)}
            className="cursor-pointer rounded-lg p-2 text-white/90 touch-manipulation active:bg-white/15"
            aria-label={t('fechar')}
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <ChatCorridaMobilidade
          conversaId={conversaId}
          visivel={aberto}
          variante="folha"
          onMensagensChange={onMensagensChange}
        />
      </div>
    </div>,
    document.body,
  )
}
