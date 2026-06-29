'use client'

import { useState } from 'react'
import { X, CalendarDays } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'
import { useGateComprasReservas } from '@/lib/useGateComprasReservas'
import PopupAvisoBloqueioConta from '@/components/PopupAvisoBloqueioConta'
import { registrarUsoPreLiberacao } from '@/lib/registrarUsoPreLiberacao'
import { sanitizarPalavrasChave } from '@/lib/palavrasChaveGuia'
import { notificarBadgeCanais } from '@/lib/canais-badge-events'
import { FORMAS_PAGAMENTO_RESERVA_HOSPEDAGEM } from '@/lib/reservaHospedagem'

/** Azul do botão dinâmico do segmento Hospedagem. */
const COR_HOSPEDAGEM = '#45B7D1'

/**
 * @param {{
 *   isOpen: boolean
 *   onClose: () => void
 *   empresaId: string
 *   empresaNome: string
 *   whatsappDestino?: string | null
 *   precoDiaria: number
 *   palavrasChave?: unknown
 *   exibirPalavrasChave?: boolean
 * }} props
 */
export default function PopupReservaHospedagem({
  isOpen,
  onClose,
  empresaId,
  empresaNome,
  precoDiaria,
  palavrasChave = [],
  exibirPalavrasChave = false,
}) {
  const { podeInteragir, notificarSomenteLeitura } = useModoApresentacao()
  const {
    podeComprarReservar,
    avisarBloqueio,
    avisoAberto,
    fecharAvisoBloqueio,
    mensagemBloqueio,
    tituloBloqueio,
  } = useGateComprasReservas()
  const [checkin, setCheckin] = useState('')
  const [checkout, setCheckout] = useState('')
  const [formaPagamento, setFormaPagamento] = useState(
    /** @type {import('@/lib/reservaHospedagem').FormaPagamentoReservaHospedagem | ''} */ (''),
  )
  const [loading, setLoading] = useState(false)
  const [sucesso, setSucesso] = useState(false)

  if (!isOpen) return null

  const calcularNoites = () => {
    if (!checkin || !checkout) return 0
    const inicio = new Date(`${checkin}T12:00:00`)
    const fim = new Date(`${checkout}T12:00:00`)
    const diff = fim.getTime() - inicio.getTime()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }

  const noites = calcularNoites()
  const diaria = Math.max(0, Number(precoDiaria) || 0)
  const total = diaria * noites
  const termos = exibirPalavrasChave ? sanitizarPalavrasChave(palavrasChave) : []

  const handleFechar = () => {
    setSucesso(false)
    setCheckin('')
    setCheckout('')
    setFormaPagamento('')
    onClose()
  }

  const handleSolicitar = async () => {
    if (!podeInteragir) {
      notificarSomenteLeitura()
      return
    }
    if (!podeComprarReservar) {
      avisarBloqueio()
      return
    }
    if (!checkin || !checkout) {
      alert('Selecione as datas de check-in e check-out')
      return
    }
    if (noites <= 0) {
      alert('Check-out deve ser após o check-in')
      return
    }
    if (!formaPagamento) {
      alert('Selecione a forma de pagamento')
      return
    }

    setLoading(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        alert('Faça login para continuar')
        return
      }

      const res = await fetch('/api/reservas-hospedagem/solicitar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          empresa_id: empresaId,
          data_checkin: checkin,
          data_checkout: checkout,
          noites,
          valor_estimado: total,
          forma_pagamento: formaPagamento,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) {
        alert(json.error ?? 'Não foi possível enviar a solicitação.')
        return
      }

      void registrarUsoPreLiberacao({
        tipo: 'reserva_hospedagem',
        descricao: `Solicitação hospedagem ${noites} noite(s) — ${empresaNome}`,
        empresaId,
      })
      notificarBadgeCanais()
      setSucesso(true)
    } finally {
      setLoading(false)
    }
  }

  const hoje = new Date().toISOString().split('T')[0]

  return (
    <>
      <div
        className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) handleFechar()
        }}
        role="presentation"
      >
        <div
          className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white text-gray-900 shadow-xl [color-scheme:light]"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="popup-reserva-hospedagem-titulo"
        >
          <div className="flex items-center justify-between border-b border-gray-100 p-4">
            <div className="flex items-center gap-2">
              <CalendarDays size={20} style={{ color: COR_HOSPEDAGEM }} aria-hidden />
              <h2 id="popup-reserva-hospedagem-titulo" className="text-lg font-semibold" style={{ color: COR_HOSPEDAGEM }}>
                Fazer Reserva
              </h2>
            </div>
            <button
              type="button"
              onClick={handleFechar}
              className="rounded p-1 text-gray-700 hover:bg-gray-100"
              aria-label="Fechar"
            >
              <X size={20} />
            </button>
          </div>

          {sucesso ? (
            <div className="space-y-4 p-6 text-center">
              <p className="text-base font-semibold" style={{ color: COR_HOSPEDAGEM }}>
                Solicitação enviada!
              </p>
              <p className="text-sm text-gray-700">
                Sua solicitação de reserva foi enviada para <strong>{empresaNome}</strong>. Aguarde a
                confirmação da empresa.
              </p>
              <button
                type="button"
                onClick={handleFechar}
                className="w-full rounded-lg py-3 font-medium text-white"
                style={{ backgroundColor: COR_HOSPEDAGEM }}
              >
                Fechar
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-3 p-4">
                <p className="text-center text-lg font-bold text-gray-900">{empresaNome}</p>
                <p className="text-center text-sm text-gray-800">
                  Diária:{' '}
                  <span className="font-semibold" style={{ color: COR_HOSPEDAGEM }}>
                    R$ {diaria.toFixed(2)}
                  </span>
                </p>

                {termos.length > 0 ? (
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {termos.map((termo) => (
                      <span
                        key={termo}
                        className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                        style={{ backgroundColor: `${COR_HOSPEDAGEM}18`, color: COR_HOSPEDAGEM }}
                      >
                        {termo}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="space-y-3">
                  <div>
                    <label htmlFor="reserva-hosp-checkin" className="mb-1 block text-xs font-medium text-gray-800">
                      Check-in
                    </label>
                    <input
                      id="reserva-hosp-checkin"
                      type="date"
                      value={checkin}
                      onChange={(e) => setCheckin(e.target.value)}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 [color-scheme:light]"
                      min={hoje}
                    />
                  </div>
                  <div>
                    <label htmlFor="reserva-hosp-checkout" className="mb-1 block text-xs font-medium text-gray-800">
                      Check-out
                    </label>
                    <input
                      id="reserva-hosp-checkout"
                      type="date"
                      value={checkout}
                      onChange={(e) => setCheckout(e.target.value)}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 [color-scheme:light]"
                      min={checkin || hoje}
                    />
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium text-gray-800">Forma de Pagamento</p>
                  <div className="space-y-2">
                    {FORMAS_PAGAMENTO_RESERVA_HOSPEDAGEM.map(({ value, label }) => (
                      <label
                        key={value}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                          formaPagamento === value
                            ? 'border-[#45B7D1] bg-[#45B7D1]/10 font-semibold text-gray-900'
                            : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="forma-pagamento-reserva"
                          value={value}
                          checked={formaPagamento === value}
                          onChange={() => setFormaPagamento(value)}
                          className="shrink-0"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>

                {noites > 0 ? (
                  <div className="border-t border-gray-100 pt-2 text-sm text-gray-900">
                    <div className="flex justify-between">
                      <span>{noites} noite(s)</span>
                      <span>R$ {total.toFixed(2)}</span>
                    </div>
                    <div className="mt-1 flex justify-between font-semibold">
                      <span>Total estimado</span>
                      <span style={{ color: COR_HOSPEDAGEM }}>R$ {total.toFixed(2)}</span>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="border-t border-gray-100 p-4">
                <button
                  type="button"
                  onClick={handleSolicitar}
                  disabled={loading || !checkin || !checkout || noites <= 0 || !formaPagamento}
                  className="w-full rounded-lg bg-[#00D443] py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  {loading ? 'Enviando…' : 'Solicitar Reserva'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <PopupAvisoBloqueioConta
        aberto={avisoAberto}
        onFechar={fecharAvisoBloqueio}
        titulo={tituloBloqueio}
        mensagem={mensagemBloqueio}
      />
    </>
  )
}
