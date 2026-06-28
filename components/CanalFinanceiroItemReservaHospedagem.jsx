'use client'

import { useEffect, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import AvatarImage from '@/components/AvatarImage'
import { notificarBadgeCanais } from '@/lib/canais-badge-events'
import { supabase } from '@/lib/supabase'
import { pickFotoTurista } from '@/lib/turistaPreLiberacao'

const AVATAR_QUADRADO = 'h-full w-full object-cover'

function formatarData(iso) {
  if (!iso) return '—'
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleDateString('pt-BR')
}

/**
 * @param {{
 *   item: {
 *     id: string
 *     titulo: string
 *     mensagem: string | null
 *     valor: number | null
 *     created_at: string
 *     metadata?: Record<string, unknown>
 *   }
 *   onRespondido: () => void
 * }} props
 */
export default function CanalFinanceiroItemReservaHospedagem({ item, onRespondido }) {
  const [loading, setLoading] = useState(false)
  const [mostrarMotivoRecusa, setMostrarMotivoRecusa] = useState(false)
  const [motivoRecusa, setMotivoRecusa] = useState('')
  const [respondidoLocal, setRespondidoLocal] = useState('')

  const meta = item.metadata && typeof item.metadata === 'object' ? item.metadata : {}
  const reservaId = String(meta.reserva_id ?? '').trim()
  const respondido = respondidoLocal || String(meta.respondido ?? '').trim()
  const pendente = !respondido

  const turistaUsername = String(meta.turista_username ?? '').trim() || 'turista'
  const turistaNome = String(meta.turista_nome ?? '').trim() || 'Turista'
  const turistaUsuarioId = String(meta.turista_usuario_id ?? '').trim()
  const fotoMetadata =
    meta.turista_foto_url != null && String(meta.turista_foto_url).trim() !== ''
      ? String(meta.turista_foto_url)
      : null
  const [turistaFotoUrl, setTuristaFotoUrl] = useState(fotoMetadata)

  const checkin = formatarData(meta.data_checkin)
  const checkout = formatarData(meta.data_checkout)
  const noites = meta.noites != null ? Number(meta.noites) : null
  const valor =
    meta.valor_estimado != null
      ? Number(meta.valor_estimado)
      : item.valor != null
        ? Number(item.valor)
        : null

  useEffect(() => {
    if (!turistaUsuarioId) {
      setTuristaFotoUrl(fotoMetadata)
      return
    }

    let cancelled = false

    const carregarFoto = async () => {
      const { data } = await supabase
        .from('turistas')
        .select('foto_perfil_url, foto_url')
        .eq('usuario_id', turistaUsuarioId)
        .maybeSingle()

      if (cancelled) return
      setTuristaFotoUrl(pickFotoTurista(data) ?? fotoMetadata)
    }

    void carregarFoto()
    return () => {
      cancelled = true
    }
  }, [turistaUsuarioId, fotoMetadata])

  const responder = async (acao) => {
    if (!reservaId || loading) return
    if (acao === 'recusar' && !motivoRecusa.trim()) {
      window.alert('Informe o motivo da recusa.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/reservas-hospedagem/responder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          reserva_id: reservaId,
          acao,
          motivo_recusa: acao === 'recusar' ? motivoRecusa.trim() : undefined,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) {
        window.alert(json.error ?? 'Não foi possível responder.')
        return
      }
      setRespondidoLocal(acao === 'confirmar' ? 'confirmada' : 'recusada')
      setMostrarMotivoRecusa(false)
      notificarBadgeCanais()
      onRespondido()
    } catch {
      window.alert('Erro de conexão.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border-l-4 border-[#45B7D1] bg-white p-4 shadow-sm">
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#45B7D1]/15 text-[#45B7D1]">
          <CalendarDays size={20} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-gray-800">{item.titulo}</h3>
          {pendente ? (
            <span className="mt-1 inline-block rounded-full bg-[#45B7D1] px-2 py-0.5 text-xs text-white">
              Aguardando confirmação
            </span>
          ) : null}

          <div className="mt-3 flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2">
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-gray-200">
              <AvatarImage src={turistaFotoUrl} alt="" fill className={AVATAR_QUADRADO} sizes="44px" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-800">{turistaNome}</p>
              <p className="truncate text-xs text-gray-500">@{turistaUsername}</p>
            </div>
          </div>

          <div className="mt-3 space-y-1 text-sm text-gray-700">
            <p>
              <span className="font-medium">Check-in:</span> {checkin}
            </p>
            <p>
              <span className="font-medium">Check-out:</span> {checkout}
            </p>
            {noites != null && Number.isFinite(noites) ? (
              <p>
                <span className="font-medium">Noites:</span> {noites}
              </p>
            ) : null}
            {valor != null && Number.isFinite(valor) ? (
              <p>
                <span className="font-medium">Valor estimado:</span> R$ {valor.toFixed(2)}
              </p>
            ) : null}
          </div>

          {item.mensagem ? <p className="mt-2 text-sm text-gray-600">{item.mensagem}</p> : null}

          <p className="mt-2 text-xs text-gray-400">{new Date(item.created_at).toLocaleString('pt-BR')}</p>

          {pendente && !mostrarMotivoRecusa ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => void responder('confirmar')}
                className="rounded-lg bg-[#00D443] px-3 py-2.5 text-sm font-bold text-white hover:opacity-95 disabled:opacity-50"
              >
                Confirmar
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => setMostrarMotivoRecusa(true)}
                className="rounded-lg bg-red-600 px-3 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                Recusar
              </button>
            </div>
          ) : null}

          {pendente && mostrarMotivoRecusa ? (
            <div className="mt-3 space-y-2">
              <label htmlFor={`motivo-recusa-${item.id}`} className="block text-sm font-medium text-gray-800">
                Motivo da recusa
              </label>
              <textarea
                id={`motivo-recusa-${item.id}`}
                value={motivoRecusa}
                onChange={(e) => setMotivoRecusa(e.target.value)}
                rows={3}
                placeholder="Informe o motivo para o turista…"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void responder('recusar')}
                  className="rounded-lg bg-red-600 px-3 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Confirmar recusa
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setMostrarMotivoRecusa(false)
                    setMotivoRecusa('')
                  }}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-medium text-gray-700"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : null}

          {!pendente && respondido === 'confirmada' ? (
            <div className="mt-3 rounded-lg border border-[#00D443]/30 bg-[#00D443]/5 px-3 py-2.5 text-sm text-gray-700">
              <p className="font-semibold text-[#00A835]">Reserva confirmada</p>
              <p className="mt-1 text-gray-600">O turista poderá ver o endereço e chamar corrida na página da hospedagem.</p>
            </div>
          ) : null}

          {!pendente && respondido === 'recusada' ? (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-gray-700">
              <p className="font-semibold text-red-700">Reserva recusada</p>
              {meta.motivo_recusa ? (
                <p className="mt-1 text-gray-600">
                  <span className="font-medium">Motivo:</span> {String(meta.motivo_recusa)}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
