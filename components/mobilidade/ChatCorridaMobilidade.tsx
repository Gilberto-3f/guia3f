'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Send } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { MOBILIDADE_POLL_CHAT_MS } from '@/lib/mobilidadePoll'

type Msg = {
  id: string
  remetente_id: string
  texto: string
  created_at: string
}

type Props = {
  conversaId: string
  compact?: boolean
  /** Se false, só faz poll (útil com chevron fechado para badge). */
  visivel?: boolean
  /** Notifica mensagens (para contador de não lidas com chevron fechado). */
  onMensagensChange?: (msgs: Msg[], meuId: string | null) => void
  /** Só leitura (chat arquivado). */
  somenteLeitura?: boolean
  /** Título/hint customizados (ex.: item esquecido). */
  titulo?: string
  hint?: string
  /** Mostra botão para encerrar e arquivar. */
  permiteEncerrar?: boolean
  onEncerrada?: () => void
}

/** Chat 1:1 temporário da corrida (fora do canal do ecossistema). */
export default function ChatCorridaMobilidade({
  conversaId,
  compact = false,
  visivel = true,
  onMensagensChange,
  somenteLeitura = false,
  titulo,
  hint,
  permiteEncerrar = false,
  onEncerrada,
}: Props) {
  const t = useTranslations('Mobilidade')
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [texto, setTexto] = useState('')
  const [busy, setBusy] = useState(false)
  const [encerrando, setEncerrando] = useState(false)
  const [status, setStatus] = useState<'aberta' | 'encerrada' | null>(null)
  const [meuId, setMeuId] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const fimRef = useRef<HTMLDivElement | null>(null)
  const onMsgsRef = useRef(onMensagensChange)
  onMsgsRef.current = onMensagensChange

  const leitura = somenteLeitura || status === 'encerrada'

  useEffect(() => {
    void supabase.auth.getSession().then(({ data: { session } }) => {
      setMeuId(session?.user?.id ?? null)
    })
  }, [])

  const carregar = useCallback(async () => {
    try {
      const res = await fetch(`/api/mobilidade/chat/${conversaId}/mensagens`)
      const json = (await res.json()) as {
        mensagens?: Msg[]
        status?: string
        error?: string
      }
      if (!res.ok) {
        setErro(String(json.error ?? t('chatErro')))
        return
      }
      const lista = Array.isArray(json.mensagens) ? json.mensagens : []
      setMsgs(lista)
      if (json.status === 'encerrada' || json.status === 'aberta') {
        setStatus(json.status)
      }
      setErro('')
    } catch {
      setErro(t('chatErro'))
    }
  }, [conversaId, t])

  useEffect(() => {
    void carregar()
    if (leitura) return
    const id = setInterval(() => void carregar(), MOBILIDADE_POLL_CHAT_MS)
    return () => clearInterval(id)
  }, [carregar, leitura])

  useEffect(() => {
    onMsgsRef.current?.(msgs, meuId)
  }, [msgs, meuId])

  useEffect(() => {
    if (!visivel) return
    fimRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs.length, visivel])

  const enviar = async () => {
    const body = texto.trim()
    if (!body || busy || leitura) return
    setBusy(true)
    try {
      const res = await fetch(`/api/mobilidade/chat/${conversaId}/mensagens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: body }),
      })
      const json = (await res.json()) as { mensagem?: Msg; error?: string }
      if (!res.ok) {
        setErro(String(json.error ?? t('chatErro')))
        return
      }
      setTexto('')
      if (json.mensagem) setMsgs((prev) => [...prev, json.mensagem!])
      else void carregar()
    } finally {
      setBusy(false)
    }
  }

  const encerrar = async () => {
    if (encerrando || leitura) return
    setEncerrando(true)
    try {
      const res = await fetch(`/api/mobilidade/chat/${conversaId}/encerrar`, {
        method: 'POST',
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        setErro(String(json.error ?? t('chatErro')))
        return
      }
      setStatus('encerrada')
      onEncerrada?.()
    } finally {
      setEncerrando(false)
    }
  }

  if (!visivel) return null

  return (
    <div
      className={`flex flex-col rounded-xl border border-gray-200 bg-white ${
        compact ? 'h-56' : 'h-72'
      }`}
    >
      <div className="border-b border-gray-100 px-3 py-2">
        <p className="text-xs font-bold uppercase tracking-wide text-[#0097b2]">
          {titulo ?? t('chatTitulo')}
        </p>
        <p className="text-[11px] text-gray-400">
          {leitura ? 'Arquivado — somente leitura' : hint ?? t('chatHint')}
        </p>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2">
        {msgs.length === 0 ? (
          <p className="py-6 text-center text-xs text-gray-400">{t('chatVazio')}</p>
        ) : (
          msgs.map((m) => {
            const meu = meuId != null && m.remetente_id === meuId
            return (
              <div key={m.id} className={`flex ${meu ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-sm ${
                    meu ? 'bg-[#0097b2] text-white' : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {m.texto}
                </div>
              </div>
            )
          })
        )}
        <div ref={fimRef} />
      </div>
      {erro ? <p className="px-3 text-xs text-rose-600">{erro}</p> : null}
      {!leitura ? (
        <div className="flex gap-2 border-t border-gray-100 p-2">
          <input
            type="text"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void enviar()
              }
            }}
            placeholder={t('chatPlaceholder')}
            className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
            maxLength={2000}
          />
          <button
            type="button"
            disabled={busy || !texto.trim()}
            onClick={() => void enviar()}
            className="rounded-lg bg-[#00D443] px-3 text-white disabled:opacity-50"
            aria-label={t('chatEnviar')}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      ) : null}
      {permiteEncerrar && !leitura ? (
        <div className="border-t border-gray-100 p-2">
          <button
            type="button"
            disabled={encerrando}
            onClick={() => void encerrar()}
            className="w-full rounded-lg border border-gray-200 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {encerrando ? 'Encerrando…' : 'Finalizar chat'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
