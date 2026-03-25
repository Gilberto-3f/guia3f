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
  compras: { texto: 'VER PRODUTOS', icon: ShoppingBag, cor: '#96CEB4', acao: 'produtos' },
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
 *   empresaId?: string
 *   empresaNome?: string
 *   whatsapp?: string | null
 *   precoTicketInteira?: number
 *   precoTicketMeia?: number
 *   precoDiaria?: number
 *   onClick?: (e: { stopPropagation: () => void }) => void
 * }} props
 */
export default function BotaoDinamico({
  categoria,
  empresaId = '',
  empresaNome = '',
  whatsapp = null,
  precoTicketInteira = 0,
  precoTicketMeia,
  precoDiaria = 0,
  onClick,
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
    const texto = `Olá! Gostaria de reservar uma mesa em ${empresaNome || 'sua empresa'}.`
    window.open(`https://wa.me/${wa}?text=${encodeURIComponent(texto)}`, '_blank')
  }

  const executarAcao = () => {
    if (!empresaId) {
      return
    }

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
        if (empresaId) router.push(`/empresa/${empresaId}`)
    }
  }

  const handleClick = (e) => {
    e.stopPropagation()
    onClick?.(e)
    executarAcao()
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-95"
        style={{ backgroundColor: config.cor }}
      >
        <Icon size={16} aria-hidden />
        {config.texto}
      </button>

      {empresaId ? (
        <>
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
      ) : null}
    </>
  )
}
