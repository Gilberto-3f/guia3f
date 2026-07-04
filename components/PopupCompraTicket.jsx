'use client'

import { useState } from 'react'
import { X, Ticket } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'
import { openWhatsAppChat } from '@/lib/whatsapp-empresa'
import { useGateComprasReservas } from '@/lib/useGateComprasReservas'
import PopupAvisoBloqueioConta from '@/components/PopupAvisoBloqueioConta'
import { registrarUsoPreLiberacao } from '@/lib/registrarUsoPreLiberacao'
import { useModalScrollLock } from '@/lib/useModalScrollLock'

/**
 * @param {{
 *   isOpen: boolean
 *   onClose: () => void
 *   empresaId: string
 *   empresaNome: string
 *   whatsappDestino?: string | null
 *   precoInteira: number
 *   precoMeia?: number
 * }} props
 */
export default function PopupCompraTicket({
  isOpen,
  onClose,
  empresaId,
  empresaNome,
  whatsappDestino,
  precoInteira,
  precoMeia,
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
  const [quantidade, setQuantidade] = useState(1)
  const [tipoIngresso, setTipoIngresso] = useState(/** @type {'inteira' | 'meia'} */ ('inteira'))
  const [loading, setLoading] = useState(false)

  useModalScrollLock(isOpen)

  if (!isOpen) return null

  const inteira = Math.max(0, Number(precoInteira) || 0)
  const meia =
    precoMeia != null && Number.isFinite(Number(precoMeia)) ? Math.max(0, Number(precoMeia)) : inteira / 2
  const preco = tipoIngresso === 'inteira' ? inteira : meia
  const total = preco * quantidade

  const handleConfirmar = async () => {
    if (!podeInteragir) {
      notificarSomenteLeitura()
      return
    }
    if (!podeComprarReservar) {
      avisarBloqueio()
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

      const tipoTxt = tipoIngresso === 'inteira' ? 'inteira' : 'meia'
      const texto = `Olá! Gostaria de comprar ${quantidade} ingresso(s) (${tipoTxt}) em ${empresaNome}. Total: R$ ${total.toFixed(2)}. (empresa: ${empresaId})`
      if (!openWhatsAppChat(whatsappDestino, texto)) {
        alert('WhatsApp da empresa não configurado.')
        return
      }
      void registrarUsoPreLiberacao({
        tipo: 'compra_ticket',
        descricao: `Ticket ${quantidade}x ${tipoIngresso} — ${empresaNome}`,
        empresaId,
      })
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
        role="presentation"
      >
        <div
          className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white text-gray-900"
          data-modal-scroll-lock-scrollable
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-center justify-between border-b border-gray-100 p-4">
            <div className="flex items-center gap-2">
              <Ticket size={20} className="text-[#0097b2]" aria-hidden />
              <h2 className="text-lg font-semibold text-[#0097b2]">Comprar Ticket</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Fechar"
            >
              <X size={20} aria-hidden />
            </button>
          </div>

          <div className="space-y-5 p-4">
            <p className="text-center text-lg font-bold text-[#001f3f]">{empresaNome}</p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTipoIngresso('inteira')}
                className={`flex-1 rounded-lg border py-2.5 text-sm font-semibold transition ${
                  tipoIngresso === 'inteira'
                    ? 'border-[#0097b2] bg-[#0097b2]/10 text-[#0097b2]'
                    : 'border-gray-200 text-gray-700'
                }`}
              >
                Inteira - R$ {inteira.toFixed(2)}
              </button>
              <button
                type="button"
                onClick={() => setTipoIngresso('meia')}
                className={`flex-1 rounded-lg border py-2.5 text-sm font-semibold transition ${
                  tipoIngresso === 'meia'
                    ? 'border-[#0097b2] bg-[#0097b2]/10 text-[#0097b2]'
                    : 'border-gray-200 text-gray-700'
                }`}
              >
                Meia - R$ {meia.toFixed(2)}
              </button>
            </div>

            <div className="text-center">
              <span className="mb-3 block text-sm font-semibold text-[#0097b2]">Quantidade</span>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setQuantidade(Math.max(1, quantidade - 1))}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-lg font-bold text-[#0097b2] hover:bg-[#0097b2]/10"
                  aria-label="Diminuir quantidade"
                >
                  -
                </button>
                <span className="min-w-[2.5rem] text-center text-xl font-bold text-[#0097b2]">{quantidade}</span>
                <button
                  type="button"
                  onClick={() => setQuantidade(quantidade + 1)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-lg font-bold text-[#0097b2] hover:bg-[#0097b2]/10"
                  aria-label="Aumentar quantidade"
                >
                  +
                </button>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between text-base font-bold text-[#0097b2]">
                <span>Total</span>
                <span>R$ {total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 p-4">
            <button
              type="button"
              onClick={handleConfirmar}
              disabled={loading}
              className="w-full rounded-lg bg-[#0097b2] py-3 font-semibold text-white hover:bg-[#008099] disabled:opacity-50"
            >
              {loading ? 'Processando...' : 'Confirmar compra'}
            </button>
          </div>
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
