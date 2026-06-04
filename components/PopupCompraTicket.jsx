'use client'

import { useState } from 'react'
import { X, Ticket } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'
import { openWhatsAppChat } from '@/lib/whatsapp-empresa'
import { useGateComprasReservas } from '@/lib/useGateComprasReservas'
import PopupAvisoBloqueioConta from '@/components/PopupAvisoBloqueioConta'
import { registrarUsoPreLiberacao } from '@/lib/registrarUsoPreLiberacao'

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
  const [cupom, setCupom] = useState('')
  const [loading, setLoading] = useState(false)

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
      const texto = `Olá! Gostaria de comprar ${quantidade} ingresso(s) (${tipoTxt}) em ${empresaNome}. Total: R$ ${total.toFixed(2)}.${cupom ? ` Cupom: ${cupom}.` : ''} (empresa: ${empresaId})`
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
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 p-4">
          <div className="flex items-center gap-2">
            <Ticket size={20} className="text-[#0097b2]" aria-hidden />
            <h2 className="text-lg font-semibold">Comprar Ticket</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1" aria-label="Fechar">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <p className="text-gray-600">{empresaNome}</p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTipoIngresso('inteira')}
              className={`flex-1 rounded-lg border py-2 ${
                tipoIngresso === 'inteira'
                  ? 'border-[#0097b2] bg-[#0097b2]/10 text-[#0097b2]'
                  : 'border-gray-200 text-gray-600'
              }`}
            >
              Inteira - R$ {inteira.toFixed(2)}
            </button>
            <button
              type="button"
              onClick={() => setTipoIngresso('meia')}
              className={`flex-1 rounded-lg border py-2 ${
                tipoIngresso === 'meia'
                  ? 'border-[#0097b2] bg-[#0097b2]/10 text-[#0097b2]'
                  : 'border-gray-200 text-gray-600'
              }`}
            >
              Meia - R$ {meia.toFixed(2)}
            </button>
          </div>

          <div>
            <span className="mb-2 block text-sm text-gray-600">Quantidade</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQuantidade(Math.max(1, quantidade - 1))}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600"
              >
                -
              </button>
              <span className="w-12 text-center text-lg font-semibold">{quantidade}</span>
              <button
                type="button"
                onClick={() => setQuantidade(quantidade + 1)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600"
              >
                +
              </button>
            </div>
          </div>

          <div>
            <span className="mb-2 block text-sm text-gray-600">Cupom de desconto</span>
            <input
              type="text"
              value={cupom}
              onChange={(e) => setCupom(e.target.value)}
              placeholder="Digite seu cupom"
              className="w-full rounded-lg border border-gray-200 p-2"
            />
          </div>

          <div className="border-t border-gray-100 pt-3">
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span className="text-[#0097b2]">R$ {total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 p-4">
          <button
            type="button"
            onClick={handleConfirmar}
            disabled={loading}
            className="w-full rounded-lg bg-[#0097b2] py-3 font-medium text-white disabled:opacity-50"
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
