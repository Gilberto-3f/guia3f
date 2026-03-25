'use client'

import { useState } from 'react'
import { Ticket, Calendar, Car, Package, Utensils, Hotel, ShoppingBag } from 'lucide-react'
import { useRouter } from 'next/navigation'
import PopupCompraTicket from '@/components/PopupCompraTicket'
import PopupReservaHospedagem from '@/components/PopupReservaHospedagem'
import { whatsappWaUrl } from '@/lib/whatsapp-empresa'

const botoesPorCategoria = {
  gastronomia: { texto: 'RESERVAR MESA', icon: Utensils, cor: '#FF6B6B', acao: 'reserva' },
  Restaurantes: { texto: 'RESERVAR MESA', icon: Utensils, cor: '#FF6B6B', acao: 'reserva' },
  passeios: { texto: 'COMPRAR TICKET', icon: Ticket, cor: '#4ECDC4', acao: 'ticket' },
  Atrativos: { texto: 'COMPRAR TICKET', icon: Ticket, cor: '#4ECDC4', acao: 'ticket' },
  lojas: { texto: 'VER PRODUTOS', icon: ShoppingBag, cor: '#96CEB4', acao: 'produtos' },
  Lojas: { texto: 'VER PRODUTOS', icon: ShoppingBag, cor: '#96CEB4', acao: 'produtos' },
  hospedagem: { texto: 'RESERVAR QUARTO', icon: Hotel, cor: '#45B7D1', acao: 'reserva' },
  Hospedagem: { texto: 'RESERVAR QUARTO', icon: Hotel, cor: '#45B7D1', acao: 'reserva' },
  mobilidade: { texto: 'CHAMAR CORRIDA', icon: Car, cor: '#FFEAA7', acao: 'corrida' },
  eventos: { texto: 'COMPRAR INGRESSO', icon: Calendar, cor: '#DDA0DD', acao: 'ticket' },
  Eventos: { texto: 'COMPRAR INGRESSO', icon: Calendar, cor: '#DDA0DD', acao: 'ticket' },
  Mobilidade: { texto: 'CHAMAR CORRIDA', icon: Car, cor: '#FFEAA7', acao: 'corrida' },
  'Compras Paraguai': { texto: 'VER OFERTAS', icon: ShoppingBag, cor: '#F1C40F', acao: 'produtos' },
}

function isHospedagem(cat) {
  return cat === 'Hospedagem' || cat === 'hospedagem'
}

function isGastronomia(cat) {
  return cat === 'Restaurantes' || cat === 'gastronomia'
}

/**
 * @param {{
 *   categoria: string
 *   empresaId: string
 *   empresaNome: string
 *   whatsapp?: string | null
 *   precoTicketInteira?: number
 *   precoTicketMeia?: number
 *   precoDiaria?: number
 * }} props
 */
export default function AbaBotaoDinamico({
  categoria,
  empresaId,
  empresaNome,
  whatsapp = null,
  precoTicketInteira = 0,
  precoTicketMeia,
  precoDiaria = 0,
}) {
  const router = useRouter()
  const [showTicketPopup, setShowTicketPopup] = useState(false)
  const [showReservaPopup, setShowReservaPopup] = useState(false)

  const config = botoesPorCategoria[categoria] || {
    texto: 'VER MAIS',
    icon: Package,
    cor: '#0097b2',
    acao: 'detalhes',
  }
  const Icon = config.icon

  const abrirWhatsappGastronomia = () => {
    const wa = whatsappWaUrl(whatsapp)
    if (!wa) {
      alert('WhatsApp da empresa não configurado.')
      return
    }
    const texto = `Olá! Gostaria de reservar uma mesa em ${empresaNome}.`
    window.open(`https://wa.me/${wa}?text=${encodeURIComponent(texto)}`, '_blank')
  }

  const handleClick = () => {
    switch (config.acao) {
      case 'reserva':
        if (isHospedagem(categoria)) {
          setShowReservaPopup(true)
        } else if (isGastronomia(categoria)) {
          abrirWhatsappGastronomia()
        } else {
          abrirWhatsappGastronomia()
        }
        break
      case 'ticket':
        setShowTicketPopup(true)
        break
      case 'produtos':
        router.push(`/compras-paraguai/${empresaId}`)
        break
      case 'corrida':
        router.push(`/mobilidade?destino_empresa=${empresaId}`)
        break
      default:
        router.push(`/empresa/${empresaId}`)
    }
  }

  return (
    <>
      <div className="rounded-xl bg-white p-6 text-center shadow-sm">
        <div
          className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full"
          style={{ backgroundColor: `${config.cor}20` }}
        >
          <Icon size={32} style={{ color: config.cor }} aria-hidden />
        </div>
        <button
          type="button"
          onClick={handleClick}
          className="w-full rounded-lg py-3 font-bold text-white transition-colors hover:opacity-90"
          style={{ backgroundColor: config.cor }}
        >
          {config.texto}
        </button>
        <p className="mt-3 text-xs text-gray-400">Clique para {config.texto.toLowerCase()}</p>
      </div>

      <PopupCompraTicket
        isOpen={showTicketPopup}
        onClose={() => setShowTicketPopup(false)}
        empresaId={empresaId}
        empresaNome={empresaNome}
        whatsappDestino={whatsapp}
        precoInteira={precoTicketInteira}
        precoMeia={precoTicketMeia}
      />

      <PopupReservaHospedagem
        isOpen={showReservaPopup}
        onClose={() => setShowReservaPopup(false)}
        empresaId={empresaId}
        empresaNome={empresaNome}
        whatsappDestino={whatsapp}
        precoDiaria={precoDiaria}
      />
    </>
  )
}
