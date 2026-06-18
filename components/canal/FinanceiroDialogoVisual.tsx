'use client'

import type { RefObject } from 'react'
import { ChevronLeft } from 'lucide-react'
import CanalMensagemAudio from '@/components/CanalMensagemAudio'
import CanalMensagemImagem from '@/components/CanalMensagemImagem'
import { ehAnexoAudioCanal, ehAnexoImagemCanal } from '@/lib/canalAnexoUrl'
import type { FinanceiroMensagemRow } from '@/lib/financeiroConversas'
import ChatReciboVisto from '@/components/chat/ChatReciboVisto'
import { idUltimaMensagemPropriaVistaPeloOutro } from '@/lib/chatVisto'

type FinanceiroDialogoVisualProps = {
  mensagens: FinanceiroMensagemRow[]
  viewerUserId: string
  vistoEmOutroMs?: number
  assunto?: string | null
  carregando?: boolean
  erro?: string | null
  onFechar: () => void
  titulo?: string
  messagesEndRef?: RefObject<HTMLDivElement | null>
  cabecalhoNome?: string
  cabecalhoMeta?: string | null
}

export default function FinanceiroDialogoVisual({
  mensagens,
  viewerUserId,
  vistoEmOutroMs = 0,
  assunto,
  carregando = false,
  erro = null,
  onFechar,
  titulo = 'Administração',
  messagesEndRef,
  cabecalhoNome,
  cabecalhoMeta,
}: FinanceiroDialogoVisualProps) {
  const nome = cabecalhoNome?.trim() || titulo

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative shrink-0 border-b border-gray-200 bg-white px-3 py-2.5">
        <button
          type="button"
          onClick={onFechar}
          className="absolute left-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#0097b2] hover:bg-gray-100"
          aria-label="Voltar"
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={2.25} aria-hidden />
        </button>
        <div className="px-10 text-center">
          <div className="truncate text-sm font-semibold text-gray-900">{nome}</div>
          {cabecalhoMeta ? <div className="truncate text-xs text-gray-500">{cabecalhoMeta}</div> : null}
          {assunto?.trim() ? <div className="truncate text-xs text-gray-500">{assunto.trim()}</div> : null}
        </div>
      </div>

      <ListaMensagensCorpo
        mensagens={mensagens}
        viewerUserId={viewerUserId}
        vistoEmOutroMs={vistoEmOutroMs}
        carregando={carregando}
        erro={erro}
        messagesEndRef={messagesEndRef}
        className="min-h-0 flex-1"
      />
    </div>
  )
}

function ListaMensagensCorpo({
  mensagens,
  viewerUserId,
  vistoEmOutroMs,
  carregando,
  erro,
  messagesEndRef,
  className = '',
}: {
  mensagens: FinanceiroMensagemRow[]
  viewerUserId: string
  vistoEmOutroMs: number
  carregando: boolean
  erro: string | null
  messagesEndRef?: RefObject<HTMLDivElement | null>
  className?: string
}) {
  const mensagemVistoId = idUltimaMensagemPropriaVistaPeloOutro(mensagens, viewerUserId, vistoEmOutroMs)

  return (
    <div className={`overflow-y-auto bg-[#e5ddd5] px-3 py-4 ${className}`}>
      {carregando ? (
        <p className="py-8 text-center text-sm text-gray-600">Carregando mensagens…</p>
      ) : erro ? (
        <p className="py-8 text-center text-sm text-red-600">{erro}</p>
      ) : mensagens.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-600">Nenhuma mensagem nesta conversa.</p>
      ) : (
        mensagens.map((m) => {
          const own = m.remetente_id === viewerUserId
          return (
            <div key={m.id} className={`mb-2 flex ${own ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm text-gray-900 shadow-sm ${
                  own ? 'bg-[#dcf8c6]' : 'bg-white'
                }`}
              >
                {m.texto ? <p className="whitespace-pre-wrap break-words">{m.texto}</p> : null}
                {ehAnexoImagemCanal(m.anexo_url, m.anexo_tipo) && m.anexo_url ? (
                  <div className="mt-1">
                    <CanalMensagemImagem src={m.anexo_url} />
                  </div>
                ) : null}
                {ehAnexoAudioCanal(m.anexo_url, m.anexo_tipo) && m.anexo_url ? (
                  <div className="mt-1">
                    <CanalMensagemAudio src={m.anexo_url} isOwn={own} />
                  </div>
                ) : null}
                {m.anexo_url && m.anexo_tipo === 'documento' ? (
                  <a
                    href={m.anexo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-sm font-medium text-[#0097b2] underline"
                  >
                    Ver documento
                  </a>
                ) : null}
                <div className="mt-0.5 text-right text-[10px] text-gray-500">
                  {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </div>
                {own ? <ChatReciboVisto visivel={m.id === mensagemVistoId} /> : null}
              </div>
            </div>
          )
        })
      )}
      <div ref={messagesEndRef} className="h-px shrink-0" aria-hidden />
    </div>
  )
}
