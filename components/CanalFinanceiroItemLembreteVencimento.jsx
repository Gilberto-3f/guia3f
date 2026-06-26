'use client'

import { CalendarClock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { notificarBadgeCanais } from '@/lib/canais-badge-events'

/**
 * Lembrete de vencimento de plano (D-5 / D-1) no canal financeiro da empresa.
 * @param {{
 *   item: {
 *     id: string
 *     titulo: string
 *     mensagem: string | null
 *     lida_por_empresa: boolean
 *     created_at: string
 *     metadata?: Record<string, unknown>
 *   }
 * }} props
 */
export default function CanalFinanceiroItemLembreteVencimento({ item }) {
  const meta = item.metadata && typeof item.metadata === 'object' ? item.metadata : {}
  const variant = String(meta.variant ?? '')
  const urgente = variant === 'lembrete_1d'

  const marcarLida = async () => {
    try {
      await supabase.from('canal_financeiro').update({ lida_por_empresa: true }).eq('id', item.id)
      notificarBadgeCanais()
    } catch {
      /* noop */
    }
  }

  return (
    <div
      className={`rounded-xl bg-white p-4 shadow-sm ${!item.lida_por_empresa ? 'border-l-4 border-amber-500' : ''} ${
        urgente ? 'ring-1 ring-amber-200' : ''
      }`}
    >
      <div className="flex gap-3">
        <CalendarClock
          className={`mt-0.5 h-5 w-5 shrink-0 ${urgente ? 'text-rose-600' : 'text-amber-600'}`}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#001f3f]">{item.titulo}</p>
          {item.mensagem ? <p className="mt-1 text-sm leading-relaxed text-gray-700">{item.mensagem}</p> : null}
          <p className="mt-2 text-xs text-gray-500">
            {new Date(item.created_at).toLocaleString('pt-BR')}
          </p>
          {!item.lida_por_empresa ? (
            <button
              type="button"
              onClick={() => void marcarLida()}
              className="mt-2 text-xs font-semibold text-[#0097b2] hover:underline"
            >
              Marcar como lida
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
