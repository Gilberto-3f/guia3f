'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, Send } from 'lucide-react'
import AvatarImage from '@/components/AvatarImage'
import type { EcossistemaConversaRow, EcossistemaMensagemRow } from '@/lib/ecossistemaConversas'

const TECLADO_BOTTOM_BAR_EVENT = 'guia-criar-keyboard'

type Props = {
  usuarioId: string
  urgenteInicial?: boolean
}

export default function ChatAdmEcossistema({ usuarioId, urgenteInicial = false }: Props) {
  const [loading, setLoading] = useState(true)
  const [conversaAberta, setConversaAberta] = useState<EcossistemaConversaRow | null>(null)
  const [arquivadas, setArquivadas] = useState<EcossistemaConversaRow[]>([])
  const [conversaVisualId, setConversaVisualId] = useState<string | null>(null)
  const [mensagens, setMensagens] = useState<EcossistemaMensagemRow[]>([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [iniciando, setIniciando] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const urgenteAplicadoRef = useRef(false)

  const conversaAtual =
    conversaAberta?.id === conversaVisualId
      ? conversaAberta
      : arquivadas.find((c) => c.id === conversaVisualId) ?? null

  const emLista = !conversaVisualId
  const podeResponder = conversaAtual?.status === 'aberta' && conversaAtual.id === conversaAberta?.id

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [])

  const carregarConversas = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const res = await fetch('/api/ecossistema-conversas')
      const json = (await res.json()) as {
        ok?: boolean
        conversaAberta?: EcossistemaConversaRow | null
        arquivadas?: EcossistemaConversaRow[]
        error?: string
      }
      if (!json.ok) {
        setErro(json.error ?? 'Não foi possível carregar o chat.')
        return
      }
      setConversaAberta(json.conversaAberta ?? null)
      setArquivadas(json.arquivadas ?? [])
      if (json.conversaAberta) setConversaVisualId(json.conversaAberta.id)
    } catch {
      setErro('Falha de conexão.')
    } finally {
      setLoading(false)
    }
  }, [])

  const abrirChat = useCallback(
    async (urgente: boolean) => {
      setIniciando(true)
      setErro(null)
      try {
        const res = await fetch('/api/ecossistema-conversas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            urgente,
            assunto: urgente ? 'Solicitação emergencial' : 'Contato com administração',
          }),
        })
        const json = (await res.json()) as { ok?: boolean; conversa?: EcossistemaConversaRow; error?: string }
        if (!json.ok || !json.conversa) {
          setErro(json.error ?? 'Não foi possível iniciar o chat.')
          return
        }
        setConversaAberta(json.conversa)
        setConversaVisualId(json.conversa.id)
      } catch {
        setErro('Falha de conexão.')
      } finally {
        setIniciando(false)
      }
    },
    [],
  )

  const carregarMensagens = useCallback(
    async (conversaId: string) => {
      const res = await fetch(`/api/ecossistema-conversas/${conversaId}/mensagens`)
      const json = (await res.json()) as { mensagens?: EcossistemaMensagemRow[] }
      setMensagens(json.mensagens ?? [])
      requestAnimationFrame(() => scrollToBottom())
    },
    [scrollToBottom],
  )

  useEffect(() => {
    void carregarConversas()
  }, [carregarConversas])

  useEffect(() => {
    if (!urgenteInicial || urgenteAplicadoRef.current || loading) return
    urgenteAplicadoRef.current = true
    if (!conversaAberta) void abrirChat(true)
  }, [urgenteInicial, loading, conversaAberta, abrirChat])

  useEffect(() => {
    if (conversaVisualId) void carregarMensagens(conversaVisualId)
    else setMensagens([])
  }, [conversaVisualId, carregarMensagens])

  useEffect(() => {
    if (!conversaVisualId || !podeResponder) return
    const emit = (hide: boolean) => {
      window.dispatchEvent(new CustomEvent(TECLADO_BOTTOM_BAR_EVENT, { detail: { hide } }))
    }
    emit(true)
    return () => emit(false)
  }, [conversaVisualId, podeResponder])

  const enviarMensagem = async () => {
    const msg = texto.trim()
    if (!msg || !conversaAberta || enviando) return
    setEnviando(true)
    try {
      const res = await fetch(`/api/ecossistema-conversas/${conversaAberta.id}/mensagens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: msg }),
      })
      const json = (await res.json()) as { ok?: boolean; mensagem?: EcossistemaMensagemRow; error?: string }
      if (!json.ok || !json.mensagem) {
        setErro(json.error ?? 'Falha ao enviar.')
        return
      }
      setMensagens((prev) => [...prev, json.mensagem!])
      setTexto('')
      scrollToBottom()
    } finally {
      setEnviando(false)
    }
  }

  if (loading) {
    return <div className="flex flex-1 items-center justify-center p-8 text-sm text-gray-500">Carregando chat...</div>
  }

  if (emLista && !conversaAberta) {
    return (
      <div className="flex flex-1 flex-col p-4">
        {erro ? <p className="mb-3 text-center text-sm text-rose-600">{erro}</p> : null}
        <div className="mx-auto max-w-md flex-1 rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#e6f7fa] text-2xl">💬</div>
          <h2 className="mt-4 text-lg font-bold text-[#001f3f]">Chat ADM</h2>
          <p className="mt-2 text-sm text-gray-600">
            Converse com a equipe de administração do app. Descreva sua dúvida ou situação e aguarde o retorno de um ADM.
          </p>
          <button
            type="button"
            disabled={iniciando}
            onClick={() => void abrirChat(false)}
            className="mt-6 w-full rounded-xl bg-[#00D443] py-3.5 text-sm font-bold uppercase tracking-wide text-white hover:bg-[#00b83b] disabled:opacity-60"
          >
            {iniciando ? 'Abrindo...' : 'Iniciar conversa'}
          </button>
        </div>
        {arquivadas.length > 0 ? (
          <div className="mx-auto mt-6 w-full max-w-md">
            <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500">Conversas anteriores</h3>
            <ul className="mt-2 space-y-2">
              {arquivadas.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setConversaVisualId(c.id)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-left text-sm hover:bg-gray-50"
                  >
                    <span className="font-semibold text-gray-800">
                      {c.urgente ? 'Atendimento emergencial' : 'Chat com ADM'}
                    </span>
                    <span className="mt-0.5 block text-xs text-gray-500">
                      Encerrado em {c.encerrada_em ? new Date(c.encerrada_em).toLocaleString('pt-BR') : '—'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    )
  }

  if (!conversaAtual) return null

  const titulo = conversaAtual.urgente ? 'Socorro — Chat ADM' : 'Chat ADM'
  const subtitulo =
    conversaAtual.status === 'encerrada'
      ? 'Conversa encerrada pela administração'
      : 'Aguardando ou em atendimento com a equipe ADM'

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative shrink-0 bg-[#0097b2] px-3 py-3">
        <button
          type="button"
          onClick={() => {
            if (conversaAtual.status === 'encerrada') setConversaVisualId(null)
            else if (arquivadas.length > 0) setConversaVisualId(null)
          }}
          className={`absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-white hover:bg-white/15 ${
            conversaAtual.status === 'aberta' && arquivadas.length === 0 ? 'invisible' : ''
          }`}
          aria-label="Voltar"
        >
          <ChevronLeft className="h-7 w-7" strokeWidth={2.5} aria-hidden />
        </button>
        <div className="flex items-center gap-3 pl-11 pr-2">
          <AvatarImage src={null} alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-md object-cover ring-2 ring-white" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold text-white">{titulo}</div>
            <div className="truncate text-xs text-white/90">{subtitulo}</div>
            {conversaAtual.urgente && conversaAtual.status === 'aberta' ? (
              <div className="mt-0.5 text-xs font-bold uppercase text-amber-200">Urgente</div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[#e5ddd5] px-3 py-4">
        {mensagens.length === 0 ? (
          <p className="text-center text-sm text-gray-600">
            {podeResponder
              ? 'Envie sua mensagem. Um administrador responderá em breve.'
              : 'Nenhuma mensagem nesta conversa.'}
          </p>
        ) : (
          mensagens.map((m) => {
            const minha = m.remetente_id === usuarioId
            return (
              <div key={m.id} className={`mb-2 flex ${minha ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                    minha ? 'bg-[#dcf8c6] text-gray-900' : 'bg-white text-gray-900'
                  }`}
                >
                  {m.texto}
                  <div className="mt-0.5 text-right text-[10px] text-gray-500">
                    {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {erro ? <p className="shrink-0 bg-rose-50 px-3 py-1 text-center text-xs text-rose-700">{erro}</p> : null}

      {podeResponder ? (
        <div className="flex shrink-0 items-end gap-2 border-t border-gray-200 bg-white px-3 py-2">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={1}
            placeholder="Digite sua mensagem..."
            className="max-h-28 min-h-[40px] flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#0097b2]"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void enviarMensagem()
              }
            }}
          />
          <button
            type="button"
            disabled={!texto.trim() || enviando}
            onClick={() => void enviarMensagem()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#00D443] text-white disabled:opacity-50"
            aria-label="Enviar"
          >
            <Send className="h-5 w-5" aria-hidden />
          </button>
        </div>
      ) : (
        <div className="shrink-0 border-t border-gray-200 bg-gray-50 px-4 py-3 text-center text-xs text-gray-600">
          Esta conversa foi encerrada. O registro está na aba Decisões em Denúncias e Decisões.
        </div>
      )}
    </div>
  )
}
