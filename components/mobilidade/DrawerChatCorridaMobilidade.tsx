'use client'

import { createPortal } from 'react-dom'
import { MessageCircle, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import ChatCorridaMobilidade from '@/components/mobilidade/ChatCorridaMobilidade'
import { useModalScrollLock } from '@/lib/useModalScrollLock'
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

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className={
        aberto
          ? 'fixed inset-0 z-[90] flex flex-col bg-white touch-manipulation'
          : 'hidden'
      }
      style={{ height: 'var(--app-height, 100dvh)' }}
      role="dialog"
      aria-modal={aberto}
      aria-hidden={!aberto}
      aria-labelledby="drawer-chat-corrida-titulo"
      data-modal-scroll-lock-scrollable
    >
      <div className="shrink-0 pt-safe" style={{ backgroundColor: headerCor }}>
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
            className="rounded-lg p-2 text-white/90 active:bg-white/15"
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
