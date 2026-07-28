'use client'

import { useEffect, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import AvatarImage from '@/components/AvatarImage'
import { notificarBadgeCanais } from '@/lib/canais-badge-events'
import { supabase } from '@/lib/supabase'
import { pickFotoTurista } from '@/lib/turistaPreLiberacao'
import { rotuloFormaPagamentoReservaHospedagem } from '@/lib/reservaHospedagem'

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
  const [posCheckoutLocal, setPosCheckoutLocal] = useState('')

  const meta = item.metadata && typeof item.metadata === 'object' ? item.metadata : {}
  const reservaId = String(meta.reserva_id ?? '').trim()
  const respondido = respondidoLocal || String(meta.respondido ?? '').trim()
  const pendente = !respondido
  const posCheckout =
    posCheckoutLocal || (meta.pos_checkout_status != null ? String(meta.pos_checkout_status) : '')

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
  const checkoutIso = meta.data_checkout != null ? String(meta.data_checkout).slice(0, 10) : ''
  const hojeIso = new Date().toISOString().slice(0, 10)
  const noDiaCheckoutOuApos =
    Boolean(checkoutIso) && hojeIso >= checkoutIso && respondido === 'confirmada'
  const noites = meta.noites != null ? Number(meta.noites) : null
  const valor =
    meta.valor_estimado != null
      ? Number(meta.valor_estimado)
      : item.valor != null
        ? Number(item.valor)
        : null
  const formaPagamentoLabel = rotuloFormaPagamentoReservaHospedagem(
    meta.forma_pagamento != null ? String(meta.forma_pagamento) : null,
  )

  const viaRecomendacao = meta.via_recomendacao === true || Boolean(meta.recomendacao_id)
  const mensagemReserva =
    meta.mensagem_reserva != null && String(meta.mensagem_reserva).trim() !== ''
      ? String(meta.mensagem_reserva)
      : null
  const parceiro =
    meta.parceiro && typeof meta.parceiro === 'object' && !Array.isArray(meta.parceiro)
      ? /** @type {Record<string, unknown>} */ (meta.parceiro)
      : null
  const comissao =
    meta.comissao && typeof meta.comissao === 'object' && !Array.isArray(meta.comissao)
      ? /** @type {Record<string, unknown>} */ (meta.comissao)
      : null
  const parceiroNome = parceiro?.nome != null ? String(parceiro.nome) : 'Profissional'
  const parceiroUsername = parceiro?.username != null ? String(parceiro.username) : ''
  const parceiroFoto = parceiro?.foto_url != null ? String(parceiro.foto_url) : null
  const comissaoTexto = comissao?.texto != null ? String(comissao.texto) : null
  const recomendadoEm =
    meta.recomendado_em != null && String(meta.recomendado_em).trim() !== ''
      ? String(meta.recomendado_em)
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

  const responderPosCheckout = async (status) => {
    if (!reservaId || loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/reservas-hospedagem/pos-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reserva_id: reservaId, status }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) {
        window.alert(json.error ?? 'Não foi possível salvar o status.')
        return
      }
      setPosCheckoutLocal(status)
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

          {viaRecomendacao && item.mensagem ? (
            <p className="mt-2 text-sm text-gray-600">{item.mensagem}</p>
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

          {mensagemReserva ? <p className="mt-2 text-sm text-gray-600">{mensagemReserva}</p> : null}
          {!viaRecomendacao && item.mensagem ? (
            <p className="mt-2 text-sm text-gray-600">{item.mensagem}</p>
          ) : null}

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
            {formaPagamentoLabel ? (
              <p>
                <span className="font-medium">Forma de pagamento:</span> {formaPagamentoLabel}
              </p>
            ) : null}
          </div>

          {viaRecomendacao && parceiro ? (
            <div className="mt-3 rounded-lg border border-[#0097b2]/20 bg-[#0097b2]/5 px-3 py-2">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#0097b2]">
                Profissional parceiro
              </p>
              <div className="flex items-center gap-3">
                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-gray-200">
                  <AvatarImage src={parceiroFoto} alt="" fill className={AVATAR_QUADRADO} sizes="44px" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-800">{parceiroNome}</p>
                  <p className="truncate text-xs text-gray-500">
                    {parceiroUsername.startsWith('@') ? parceiroUsername : `@${parceiroUsername}`}
                  </p>
                </div>
              </div>
              {recomendadoEm ? (
                <p className="mt-2 text-xs text-gray-400">
                  Recomendação: {new Date(recomendadoEm).toLocaleString('pt-BR')}
                </p>
              ) : null}
              {comissaoTexto ? (
                <p className="mt-2 text-sm text-gray-700">
                  <span className="font-medium">Comissão:</span> {comissaoTexto}
                </p>
              ) : (
                <p className="mt-2 text-sm text-amber-700">
                  Cadastre uma oferta de comissão para a categoria deste colega em Comissões.
                </p>
              )}
            </div>
          ) : null}

          <p className="mt-2 text-xs text-gray-400">{new Date(item.created_at).toLocaleString('pt-BR')}</p>

          {pendente && !mostrarMotivoRecusa ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => void responder('confirmar')}
                className="rounded-lg bg-[#00D443] px-3 py-2.5 text-sm font-bold text-white hover:opacity-95 disabled:opacity-50"
              >
                CONFIRMAR
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => setMostrarMotivoRecusa(true)}
                className="rounded-lg bg-red-600 px-3 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                RECUSAR
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
              <p className="mt-1 text-gray-600">
                O turista poderá ver o endereço e chamar corrida na página da hospedagem.
              </p>
              {noDiaCheckoutOuApos ? (
                <div className="mt-3 border-t border-[#00D443]/20 pt-3">
                  <p className="font-semibold text-[#001f3f]">Relatório de pagamento (check-out)</p>
                  <p className="mt-1 text-xs text-gray-600">
                    Período {checkin} → {checkout}
                    {noites != null ? ` · ${noites} noite(s)` : ''}
                    {valor != null && Number.isFinite(valor)
                      ? ` · Total R$ ${valor.toFixed(2)}`
                      : ''}
                    {formaPagamentoLabel ? ` · ${formaPagamentoLabel}` : ''}
                  </p>
                  {!posCheckout ? (
                    <>
                      <p className="mt-2 text-sm font-medium text-gray-800">
                        Qual o novo status da acomodação?
                      </p>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => void responderPosCheckout('disponivel')}
                          className="rounded-lg bg-[#00D443] px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                        >
                          Disponível
                        </button>
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => void responderPosCheckout('ocupado')}
                          className="rounded-lg bg-[#0097b2] px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                        >
                          Ocupado
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="mt-2 text-sm font-semibold text-[#0097b2]">
                      Status registrado: {posCheckout === 'disponivel' ? 'Disponível' : 'Ocupado'}
                    </p>
                  )}
                </div>
              ) : null}
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
