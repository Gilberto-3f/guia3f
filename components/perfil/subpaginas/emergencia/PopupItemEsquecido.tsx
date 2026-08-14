'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { MessageSquare, X } from 'lucide-react'
import ChatCorridaMobilidade from '@/components/mobilidade/ChatCorridaMobilidade'

type Props = {
  aberto: boolean
  solicitacaoId: string
  onFechar: () => void
  onChatEncerrado?: () => void
}

/**
 * Popup "Esqueci um item" — mensagem + chat temporário com o profissional da corrida.
 */
export default function PopupItemEsquecido({
  aberto,
  solicitacaoId,
  onFechar,
  onChatEncerrado,
}: Props) {
  const [conversaId, setConversaId] = useState<string | null>(null)
  const [abrindoChat, setAbrindoChat] = useState(false)
  const [erro, setErro] = useState('')

  if (!aberto || typeof document === 'undefined') return null

  const abrirChat = async () => {
    if (abrindoChat) return
    setAbrindoChat(true)
    setErro('')
    try {
      const res = await fetch('/api/mobilidade/chat/item-esquecido', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ solicitacao_id: solicitacaoId }),
      })
      const json = (await res.json()) as { conversa_id?: string; error?: string }
      if (!res.ok || !json.conversa_id) {
        setErro(String(json.error ?? 'Não foi possível abrir o chat.'))
        return
      }
      setConversaId(String(json.conversa_id))
    } catch {
      setErro('Não foi possível abrir o chat.')
    } finally {
      setAbrindoChat(false)
    }
  }

  const fechar = () => {
    setConversaId(null)
    setErro('')
    onFechar()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[180] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) fechar()
      }}
      role="presentation"
    >
      <div
        className="flex max-h-[min(90dvh,36rem)] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="popup-item-esquecido-titulo"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
          <h3 id="popup-item-esquecido-titulo" className="text-sm font-bold text-[#001f3f]">
            Esqueci um item
          </h3>
          <button
            type="button"
            onClick={fechar}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          <p className="text-sm text-gray-600">
            Esqueceu um pertence no veículo do profissional que lhe atendeu? Avise a administração pelo
            mensageiro — o ADM verá os últimos profissionais que o atenderam para facilitar o contato.
          </p>
          <p className="text-sm text-gray-600">
            Em caso de deslocamento para devolução na sua localização, pode haver uma taxa a partir de
            R$25,00 a ser pago para o profissional.
          </p>

          {!conversaId ? (
            <button
              type="button"
              disabled={abrindoChat}
              onClick={() => void abrirChat()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00D443] py-3 text-sm font-bold uppercase tracking-wide text-white hover:bg-[#00b83a] disabled:opacity-50"
            >
              <MessageSquare className="h-5 w-5 shrink-0" aria-hidden />
              {abrindoChat ? 'Abrindo…' : 'Chat com o profissional'}
            </button>
          ) : (
            <ChatCorridaMobilidade
              conversaId={conversaId}
              titulo="Item esquecido"
              hint="Temporário — combine a devolução e finalize quando concluir"
              permiteEncerrar
              onEncerrada={() => {
                onChatEncerrado?.()
                fechar()
              }}
            />
          )}

          {erro ? <p className="text-center text-xs text-rose-600">{erro}</p> : null}
        </div>
      </div>
    </div>,
    document.body,
  )
}
