'use client'

import { useState } from 'react'
import { X, CalendarDays } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'
import { useGateComprasReservas } from '@/lib/useGateComprasReservas'
import PopupAvisoBloqueioConta from '@/components/PopupAvisoBloqueioConta'
import { registrarUsoPreLiberacao } from '@/lib/registrarUsoPreLiberacao'
import { sanitizarPalavrasChave } from '@/lib/palavrasChaveGuia'

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

    setLoading(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        alert('Faça login para continuar')
        return
      }

      const { error } = await supabase.from('reservas_hospedagem').insert({
        empresa_id: empresaId,
        turista_usuario_id: session.user.id,
        data_checkin: checkin,
        data_checkout: checkout,
        status: 'pendente',
        valor_estimado: total,
        noites,
      })

      if (error) {
        alert(error.message || 'Não foi possível enviar a solicitação.')
        return
      }

      void registrarUsoPreLiberacao({
        tipo: 'reserva_hospedagem',
        descricao: `Solicitação hospedagem ${noites} noite(s) — ${empresaNome}`,
        empresaId,
      })
      setSucesso(true)
    } finally {
      setLoading(false)
    }
  }

  const hoje = new Date().toISOString().split('T')[0]

  return (
    <>
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
        <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 p-4">
            <div className="flex items-center gap-2">
              <CalendarDays size={20} className="text-[#0097b2]" aria-hidden />
              <h2 className="text-lg font-semibold">Reservar Hospedagem</h2>
            </div>
            <button type="button" onClick={handleFechar} className="p-1" aria-label="Fechar">
              <X size={20} />
            </button>
          </div>

          {sucesso ? (
            <div className="space-y-4 p-6 text-center">
              <p className="text-base font-semibold text-[#0097b2]">Solicitação enviada!</p>
              <p className="text-sm text-gray-600">
                Sua solicitação de reserva foi enviada para <strong>{empresaNome}</strong>. Aguarde a
                confirmação da empresa.
              </p>
              <button
                type="button"
                onClick={handleFechar}
                className="w-full rounded-lg bg-[#0097b2] py-3 font-medium text-white"
              >
                Fechar
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-4 p-4">
                <p className="text-center text-lg font-bold text-gray-900">{empresaNome}</p>
                <p className="text-center text-sm text-gray-600">
                  Diária: <span className="font-semibold text-[#0097b2]">R$ {diaria.toFixed(2)}</span>
                </p>

                {termos.length > 0 ? (
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {termos.map((termo) => (
                      <span
                        key={termo}
                        className="rounded-full bg-[#0097b2]/10 px-2.5 py-0.5 text-xs font-medium text-[#0097b2]"
                      >
                        {termo}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="mb-1 block text-sm text-gray-600">Check-in</span>
                    <input
                      type="date"
                      value={checkin}
                      onChange={(e) => setCheckin(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 p-2"
                      min={hoje}
                    />
                  </div>
                  <div>
                    <span className="mb-1 block text-sm text-gray-600">Check-out</span>
                    <input
                      type="date"
                      value={checkout}
                      onChange={(e) => setCheckout(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 p-2"
                      min={checkin || hoje}
                    />
                  </div>
                </div>

                {noites > 0 ? (
                  <div className="border-t border-gray-100 pt-3">
                    <div className="flex justify-between">
                      <span>{noites} noite(s)</span>
                      <span>R$ {total.toFixed(2)}</span>
                    </div>
                    <div className="mt-2 flex justify-between font-semibold">
                      <span>Total estimado</span>
                      <span className="text-[#0097b2]">R$ {total.toFixed(2)}</span>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="border-t border-gray-100 p-4">
                <button
                  type="button"
                  onClick={handleSolicitar}
                  disabled={loading || !checkin || !checkout || noites <= 0}
                  className="w-full rounded-lg bg-[#00D443] py-3 font-bold text-white disabled:opacity-50"
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
