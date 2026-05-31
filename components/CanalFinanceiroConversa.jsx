'use client'

import { useCallback, useEffect, useState } from 'react'
import { Send } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  buscarConversaAbertaParaAlvo,
  enviarMensagemConversaFinanceiro,
  listarMensagensConversa,
} from '@/lib/financeiroConversas'

/**
 * Mensageiro 1:1 com a administração (canal financeiro — profissional ou empresa).
 * @param {{ usuarioId: string }} props
 */
export default function CanalFinanceiroConversa({ usuarioId }) {
  const [conversaId, setConversaId] = useState(/** @type {string | null} */ (null))
  const [mensagens, setMensagens] = useState(/** @type {Array<{ id: string; remetente_id: string; texto: string; created_at: string }>} */ ([]))
  const [texto, setTexto] = useState('')
  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)

  const carregar = useCallback(async () => {
    if (!usuarioId) return
    setLoading(true)
    try {
      const conv = await buscarConversaAbertaParaAlvo(supabase, usuarioId)
      if (!conv) {
        setConversaId(null)
        setMensagens([])
        return
      }
      setConversaId(conv.id)
      const msgs = await listarMensagensConversa(supabase, conv.id)
      setMensagens(msgs)
    } finally {
      setLoading(false)
    }
  }, [usuarioId])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const enviar = async () => {
    if (!conversaId || !texto.trim() || enviando) return
    setEnviando(true)
    try {
      const res = await enviarMensagemConversaFinanceiro(supabase, {
        conversaId,
        remetenteId: usuarioId,
        texto: texto.trim(),
      })
      if (res.ok && res.mensagem) {
        setMensagens((prev) => [...prev, res.mensagem])
        setTexto('')
      }
    } finally {
      setEnviando(false)
    }
  }

  if (loading) {
    return (
      <div className="border-b border-gray-100 bg-white px-4 py-3 text-center text-xs text-gray-500">
        Verificando mensagens da administração…
      </div>
    )
  }

  if (!conversaId) return null

  return (
    <section className="border-b border-[#0097b2]/20 bg-[#0097b2]/5">
      <div className="px-4 py-2">
        <h3 className="text-sm font-semibold text-[#007a8c]">Conversa com a administração</h3>
        <p className="text-xs text-gray-600">Mensageiro particular — responda abaixo.</p>
      </div>
      <ul className="max-h-48 space-y-2 overflow-y-auto px-4 pb-2">
        {mensagens.length === 0 ? (
          <li className="text-center text-xs text-gray-500">Aguardando mensagens…</li>
        ) : (
          mensagens.map((m) => {
            const own = m.remetente_id === usuarioId
            return (
              <li
                key={m.id}
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  own ? 'ml-auto bg-[#d4edf4] text-gray-900' : 'bg-white text-gray-900 shadow-sm'
                }`}
              >
                {m.texto}
                <div className="mt-0.5 text-[10px] text-gray-500">
                  {new Date(m.created_at).toLocaleString('pt-BR')}
                </div>
              </li>
            )
          })
        )}
      </ul>
      <div className="flex gap-2 border-t border-[#0097b2]/15 bg-white px-3 py-2">
        <input
          type="text"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void enviar()
            }
          }}
          placeholder="Responder à administração…"
          className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#0097b2]"
        />
        <button
          type="button"
          disabled={!texto.trim() || enviando}
          onClick={() => void enviar()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0097b2] text-white disabled:opacity-50"
          aria-label="Enviar"
        >
          <Send className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </section>
  )
}
