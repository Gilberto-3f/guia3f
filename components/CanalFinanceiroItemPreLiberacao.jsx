'use client'

import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { notificarBadgeCanais } from '@/lib/canais-badge-events'

/**
 * @param {{
 *   item: { id: string; titulo: string; mensagem: string | null; created_at: string; metadata?: Record<string, unknown> }
 *   onRespondido: () => void
 * }} props
 */
export default function CanalFinanceiroItemPreLiberacao({ item, onRespondido }) {
  const [loading, setLoading] = useState(false)
  const meta = item.metadata && typeof item.metadata === 'object' ? item.metadata : {}
  const solicitacaoId = String(meta.solicitacao_id ?? '').trim()
  const respondido = String(meta.respondido ?? '').trim()
  const pendente = !respondido

  const responder = async (acao) => {
    if (!solicitacaoId || loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/profissional/pre-liberacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ solicitacao_id: solicitacaoId, acao }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) {
        window.alert(json.error ?? 'Não foi possível responder.')
        return
      }
      notificarBadgeCanais()
      window.dispatchEvent(new Event('turista-gate-refresh'))
      onRespondido()
    } catch {
      window.alert('Erro de conexão.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border-l-4 border-[#00D443] bg-white p-4 shadow-sm">
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#00D443]/10 text-[#00D443]">
          <KeyRound size={20} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-gray-800">{item.titulo}</h3>
          {pendente ? (
            <span className="mt-1 inline-block rounded-full bg-[#00D443] px-2 py-0.5 text-xs text-white">
              Aguardando sua resposta
            </span>
          ) : null}
          {item.mensagem ? <p className="mt-2 whitespace-pre-line text-sm text-gray-600">{item.mensagem}</p> : null}
          <p className="mt-2 text-xs text-gray-400">{new Date(item.created_at).toLocaleString('pt-BR')}</p>

          {pendente ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => void responder('aprovar')}
                className="rounded-lg bg-[#00D443] px-4 py-2 text-sm font-bold text-white hover:opacity-95 disabled:opacity-50"
              >
                Autorizar 24h
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void responder('recusar')}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Recusar
              </button>
            </div>
          ) : (
            <p className="mt-2 text-xs font-medium text-gray-500">
              Respondido: {respondido === 'aprovada' ? 'autorizado' : 'recusado'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
