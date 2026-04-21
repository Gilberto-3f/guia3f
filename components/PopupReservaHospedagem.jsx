'use client'

import { useState } from 'react'
import { X, CalendarDays } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'
import { whatsappWaUrl } from '@/lib/whatsapp-empresa'

/**
 * @param {{
 *   isOpen: boolean
 *   onClose: () => void
 *   empresaId: string
 *   empresaNome: string
 *   whatsappDestino?: string | null
 *   precoDiaria: number
 * }} props
 */
export default function PopupReservaHospedagem({
  isOpen,
  onClose,
  empresaId,
  empresaNome,
  whatsappDestino,
  precoDiaria,
}) {
  const { podeInteragir, notificarSomenteLeitura } = useModoApresentacao()
  const [checkin, setCheckin] = useState('')
  const [checkout, setCheckout] = useState('')
  const [loading, setLoading] = useState(false)

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

  const handleConfirmar = async () => {
    if (!podeInteragir) {
      notificarSomenteLeitura()
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

      const wa = whatsappWaUrl(whatsappDestino)
      if (!wa) {
        alert('WhatsApp da empresa não configurado.')
        return
      }

      const mensagem = `Olá! Gostaria de reservar em ${empresaNome} do dia ${checkin} até ${checkout} (${noites} noite(s)). Total: R$ ${total.toFixed(2)}. (empresa: ${empresaId})`
      window.open(`https://wa.me/${wa}?text=${encodeURIComponent(mensagem)}`, '_blank')
      onClose()
    } finally {
      setLoading(false)
    }
  }

  const hoje = new Date().toISOString().split('T')[0]

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 p-4">
          <div className="flex items-center gap-2">
            <CalendarDays size={20} className="text-[#0097b2]" aria-hidden />
            <h2 className="text-lg font-semibold">Reservar Hospedagem</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1" aria-label="Fechar">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <p className="text-gray-600">{empresaNome}</p>
          <p className="text-sm text-gray-500">Diária: R$ {diaria.toFixed(2)}</p>

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
                <span>Total</span>
                <span className="text-[#0097b2]">R$ {total.toFixed(2)}</span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="border-t border-gray-100 p-4">
          <button
            type="button"
            onClick={handleConfirmar}
            disabled={loading || !checkin || !checkout || noites <= 0}
            className="w-full rounded-lg bg-[#0097b2] py-3 font-medium text-white disabled:opacity-50"
          >
            {loading ? 'Processando...' : 'Confirmar reserva'}
          </button>
        </div>
      </div>
    </div>
  )
}
