'use client'

import { useEffect, useState } from 'react'
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
  const [caixa, setCaixa] = useState(() =>
    typeof window === 'undefined' ? { top: 0, height: 0 } : caixaVisualViewport(),
  )

  useEffect(() => {
    if (!aberto) return
    const sync = () => {
      refreshAppViewportHeight()
      setCaixa(caixaVisualViewport())
    }
    sync()
    window.visualViewport?.addEventListener('resize', sync)
    window.visualViewport?.addEventListener('scroll', sync)
    window.addEventListener('resize', sync)
    return () => {
      window.visualViewport?.removeEventListener('resize', sync)
      window.visualViewport?.removeEventListener('scroll', sync)
      window.removeEventListener('resize', sync)
    }
  }, [aberto])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className={
        aberto
          ? 'fixed left-0 right-0 z-[90] flex flex-col overflow-hidden bg-white touch-manipulation'
          : 'hidden'
      }
      style={
        aberto
          ? { top: caixa.top, height: caixa.height || 'var(--app-height, 100dvh)' }
          : undefined
      }
      role="dialog"
      aria-modal={aberto}
      aria-hidden={!aberto}
      aria-labelledby="drawer-chat-corrida-titulo"
      data-modal-scroll-lock-scrollable
    >
      <div
        className={caixa.top > 0 ? 'shrink-0' : 'shrink-0 pt-safe'}
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
