'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, ChevronUp, Send, X } from 'lucide-react'
import AvatarImage from '@/components/AvatarImage'
import type { EcossistemaConversaRow, EcossistemaMensagemRow } from '@/lib/ecossistemaConversas'

type AbaEcossistema = 'turista' | 'profissional' | 'empresa' | 'historico'

type MembroCard = {
  usuarioId: string
  nome: string
  username: string
  fotoUrl: string | null
  subtitulo: string
  tipo: 'turista' | 'profissional' | 'empresa'
}

type ConversaComMembro = EcossistemaConversaRow & { membro: MembroCard }

const COR_LOGO = '#0097b2'

const abaCls = (ativo: boolean) =>
  `flex-1 rounded-lg px-2 py-2 text-xs font-semibold transition-colors sm:text-sm ${
    ativo ? 'bg-[#00D443] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
  }`

/**
 * Hub Mensageiro ECOSSISTEMA — ADM atende chats iniciados pelos membros.
 */
export default function CanalEcossistemaAdm({ embedded = false }: { embedded?: boolean }) {
  const [aba, setAba] = useState<AbaEcossistema>('turista')
  const [conversas, setConversas] = useState<ConversaComMembro[]>([])
  const [selecionada, setSelecionada] = useState<ConversaComMembro | null>(null)
  const [mensagens, setMensagens] = useState<EcossistemaMensagemRow[]>([])
  const [textoMsg, setTextoMsg] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [painelAberto, setPainelAberto] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

    setCarregando(true)
    try {
      const status = aba === 'historico' ? 'encerrada' : 'aberta'
      const qs =
        aba === 'historico'
          ? ''
          : `&membro_tipo=${encodeURIComponent(aba)}`
      const res = await fetch(
        `/api/admin/ecossistema-conversas?status=${status === 'aberta' ? 'aberta' : 'encerrada'}${qs}`,
      )
      const json = (await res.json()) as { ok?: boolean; conversas?: ConversaComMembro[] }
      setConversas(json.conversas ?? [])
    } catch {
      setConversas([])
    } finally {
      setCarregando(false)
    }
  }, [aba])

  const carregarMensagens = useCallback(async (conversaId: string) => {
    const res = await fetch(`/api/admin/ecossistema-conversas/${conversaId}/mensagens`)
    const json = (await res.json()) as { mensagens?: EcossistemaMensagemRow[] }
    setMensagens(json.mensagens ?? [])
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [])

  useEffect(() => {
    void carregarLista()
    setSelecionada(null)
    setPainelAberto(false)
  }, [carregarLista])

  useEffect(() => {
    if (!selecionada?.id || !painelAberto) return
    void carregarMensagens(selecionada.id)
    const ch = setInterval(() => void carregarMensagens(selecionada.id), 8000)
    return () => clearInterval(ch)
  }, [selecionada?.id, painelAberto, carregarMensagens])

  const abrirConversa = (c: ConversaComMembro) => {
    setSelecionada(c)
    setPainelAberto(true)
    void fetch('/api/admin/ecossistema-conversas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversa_id: c.id }),
    })
  }

  const enviarMensagem = async () => {
    if (!selecionada?.id || !textoMsg.trim() || enviando) return
    setEnviando(true)
    try {
      const res = await fetch(`/api/admin/ecossistema-conversas/${selecionada.id}/mensagens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: textoMsg.trim() }),
      })
      const json = (await res.json()) as { ok?: boolean; mensagem?: EcossistemaMensagemRow; error?: string }
      if (!json.ok || !json.mensagem) {
        window.alert(json.error ?? 'Falha ao enviar.')
        return
      }
      setMensagens((prev) => [...prev, json.mensagem!])
      setTextoMsg('')
      void carregarLista()
    } finally {
      setEnviando(false)
    }
  }

  const encerrarConversa = async () => {
    if (!selecionada?.id) return
    if (!window.confirm('Encerrar este diálogo? O usuário verá o registro na aba Decisões.')) return
    const res = await fetch(`/api/admin/ecossistema-conversas/${selecionada.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'encerrar' }),
    })
    const json = (await res.json()) as { ok?: boolean; error?: string }
    if (!json.ok) {
      window.alert(json.error ?? 'Erro ao encerrar.')
      return
    }
    setPainelAberto(false)
    setSelecionada(null)
    void carregarLista()
  }

  const wrapperCls = embedded
    ? 'relative flex min-h-0 flex-1 flex-col overflow-hidden'
    : 'relative mx-auto flex w-full max-w-3xl min-h-[70vh] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm'

  return (
    <div className={wrapperCls}>
      <div className="shrink-0 border-b border-gray-100 bg-white p-3">
        <p className="text-center text-xs font-medium text-gray-500">
          Mensageiro ECOSSISTEMA — atendimentos iniciados pelos membros
        </p>
        <div className="mt-2 flex gap-1">
          {(['turista', 'profissional', 'empresa', 'historico'] as AbaEcossistema[]).map((t) => (
            <button key={t} type="button" onClick={() => setAba(t)} className={abaCls(aba === t)}>
              {t === 'historico' ? 'Histórico' : t === 'turista' ? 'Turistas' : t === 'profissional' ? 'Profissionais' : 'Empresas'}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {carregando ? (
          <p className="text-center text-sm text-gray-500">Carregando...</p>
        ) : conversas.length === 0 ? (
          <p className="rounded-lg bg-gray-50 p-6 text-center text-sm text-gray-500">
            {aba === 'historico' ? 'Nenhuma conversa encerrada.' : 'Nenhum chat aguardando nesta categoria.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {conversas.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => abrirConversa(c)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition hover:bg-gray-50 ${
                    c.urgente && c.status === 'aberta' ? 'border-red-300 bg-red-50/60' : 'border-gray-200 bg-white'
                  }`}
                >
                  <AvatarImage
                    src={c.membro.fotoUrl}
                    alt=""
                    width={44}
                    height={44}
                    className="h-11 w-11 shrink-0 rounded-md object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold text-gray-900">{c.membro.nome}</span>
                      {c.urgente && c.status === 'aberta' ? (
                        <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" aria-hidden />
                      ) : null}
                    </div>
                    <div className="truncate text-xs text-[#0097b2]">{c.membro.username}</div>
                    {c.membro.subtitulo ? (
                      <div className="truncate text-xs text-gray-500">{c.membro.subtitulo}</div>
                    ) : null}
                  </div>
                  <ChevronUp className="h-5 w-5 shrink-0 rotate-90 text-gray-400" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {painelAberto && selecionada ? (
        <div className="absolute inset-0 z-20 flex flex-col bg-white sm:relative sm:inset-auto sm:shrink-0 sm:border-t sm:border-gray-200">
          <div className="flex shrink-0 items-center gap-2 bg-[#0097b2] px-3 py-2 text-white">
            <button
              type="button"
              onClick={() => setPainelAberto(false)}
              className="rounded-lg px-2 py-1 text-sm hover:bg-white/10"
            >
              Voltar
            </button>
            <div className="min-w-0 flex-1 truncate font-semibold">
              {selecionada.membro.nome} · {selecionada.membro.username}
            </div>
            {selecionada.status === 'aberta' ? (
              <button
                type="button"
                onClick={() => void encerrarConversa()}
                className="rounded-lg bg-white/15 px-2 py-1 text-xs font-semibold hover:bg-white/25"
              >
                Encerrar
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setPainelAberto(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/15"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-[#e5ddd5] px-3 py-3" style={{ maxHeight: embedded ? undefined : '280px' }}>
            {mensagens.map((m) => {
              const adm = m.remetente_id !== selecionada.membro_usuario_id
              return (
                <div key={m.id} className={`mb-2 flex ${adm ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                      adm ? 'bg-[#dcf8c6]' : 'bg-white'
                    }`}
                  >
                    {m.texto}
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>

          {selecionada.status === 'aberta' ? (
            <div className="flex shrink-0 items-center gap-2 border-t border-gray-200 px-3 py-2">
              <input
                value={textoMsg}
                onChange={(e) => setTextoMsg(e.target.value)}
                placeholder="Responder..."
                className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void enviarMensagem()
                }}
              />
              <button
                type="button"
                disabled={!textoMsg.trim() || enviando}
                onClick={() => void enviarMensagem()}
                className="flex h-10 w-10 items-center justify-center rounded-full text-white disabled:opacity-50"
                style={{ backgroundColor: COR_LOGO }}
                aria-label="Enviar"
              >
                <Send className="h-5 w-5" aria-hidden />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
