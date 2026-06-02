'use client'

import type { RefObject } from 'react'
import { ChevronLeft } from 'lucide-react'
import AvatarImage from '@/components/AvatarImage'
import CanalMensagemAudio from '@/components/CanalMensagemAudio'
import CanalMensagemImagem from '@/components/CanalMensagemImagem'
import { ehAnexoAudioCanal, ehAnexoImagemCanal } from '@/lib/canalAnexoUrl'
import type { FinanceiroMensagemRow } from '@/lib/financeiroConversas'

const AVATAR_QUADRADO = 'shrink-0 rounded-md object-cover ring-2 ring-white'

type FinanceiroDialogoVisualProps = {
  mensagens: FinanceiroMensagemRow[]
  viewerUserId: string
  assunto?: string | null
  subtitulo?: string | null
  carregando?: boolean
  erro?: string | null
  onFechar: () => void
  titulo?: string
  messagesEndRef?: RefObject<HTMLDivElement | null>
  /** Cabeçalho azul da logo (histórico / diálogo arquivado). */
  cabecalhoHistorico?: boolean
  cabecalhoNome?: string
  cabecalhoFotoUrl?: string | null
  cabecalhoMeta?: string | null
}

export default function FinanceiroDialogoVisual({
  mensagens,
  viewerUserId,
  assunto,
  subtitulo,
  carregando = false,
  erro = null,
  onFechar,
  titulo = 'Mensagem do ADM',
  messagesEndRef,
  cabecalhoHistorico = false,
  cabecalhoNome,
  cabecalhoFotoUrl = null,
  cabecalhoMeta,
}: FinanceiroDialogoVisualProps) {
  if (cabecalhoHistorico) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="relative shrink-0 bg-[#0097b2] px-3 py-3">
          <button
            type="button"
            onClick={onFechar}
            className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-white hover:bg-white/15"
            aria-label="Voltar"
          >
            <ChevronLeft className="h-7 w-7" strokeWidth={2.5} aria-hidden />
          </button>
          <div className="flex items-center gap-3 pl-11 pr-2">
            <AvatarImage
              src={cabecalhoFotoUrl}
              alt=""
              width={44}
              height={44}
              className={`h-11 w-11 ${AVATAR_QUADRADO}`}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold text-white">
                {cabecalhoNome?.trim() || 'Administração'}
              </div>
              {cabecalhoMeta ? (
                <div className="truncate text-xs text-white/90">{cabecalhoMeta}</div>
              ) : null}
              {assunto?.trim() ? (
                <div className="truncate text-xs text-white/80">{assunto.trim()}</div>
              ) : null}
            </div>
          </div>
        </div>

        <ListaMensagensCorpo
          mensagens={mensagens}
          viewerUserId={viewerUserId}
          carregando={carregando}
          erro={erro}
          messagesEndRef={messagesEndRef}
          className="min-h-0 flex-1 bg-white"
        />
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative shrink-0 border-b border-gray-100 bg-white px-3 py-3">
        <button
          type="button"
          onClick={onFechar}
          className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#0097b2] hover:bg-gray-100"
          aria-label="Voltar"
        >
          <ChevronLeft className="h-7 w-7" strokeWidth={2.5} aria-hidden />
        </button>
        <h2 className="px-10 text-center text-lg font-bold uppercase tracking-wide text-[#0097b2] sm:text-xl">
          {titulo}
        </h2>
        {assunto?.trim() ? (
          <p className="mt-1 px-8 text-center text-sm font-medium text-gray-800">{assunto.trim()}</p>
        ) : null}
        {subtitulo ? <p className="mt-0.5 text-center text-xs text-gray-500">{subtitulo}</p> : null}
      </div>

      <ListaMensagensCorpo
        mensagens={mensagens}
        viewerUserId={viewerUserId}
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
  carregando,
  erro,
  messagesEndRef,
  className = '',
}: {
  mensagens: FinanceiroMensagemRow[]
  viewerUserId: string
  carregando: boolean
  erro: string | null
  messagesEndRef?: RefObject<HTMLDivElement | null>
  className?: string
}) {
  return (
    <ul className={`space-y-2 overflow-y-auto px-4 py-3 ${className}`}>
      {carregando ? (
        <li className="py-8 text-center text-sm text-gray-500">Carregando mensagens…</li>
      ) : erro ? (
        <li className="py-8 text-center text-sm text-red-600">{erro}</li>
      ) : mensagens.length === 0 ? (
        <li className="py-8 text-center text-sm text-gray-500">Nenhuma mensagem nesta conversa.</li>
      ) : (
        mensagens.map((m) => {
          const own = m.remetente_id === viewerUserId
          return (
            <li
              key={m.id}
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                own ? 'ml-auto bg-[#d4edf4] text-gray-900' : 'bg-white text-gray-900 shadow-sm'
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
              <div className="mt-0.5 text-[10px] text-gray-500">
                {new Date(m.created_at).toLocaleString('pt-BR')}
              </div>
            </li>
          )
        })
      )}
      <div ref={messagesEndRef} className="h-px shrink-0" aria-hidden />
    </ul>
  )
}
