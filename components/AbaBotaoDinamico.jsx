'use client'

import { useEffect, useMemo, useState } from 'react'
import { Ticket, Calendar, Car, Package, Utensils, Hotel, ShoppingBag, MessageCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import PopupCompraTicket from '@/components/PopupCompraTicket'
import PopupReservaHospedagem from '@/components/PopupReservaHospedagem'
import { whatsappWaUrl } from '@/lib/whatsapp-empresa'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import { cidadeEhCiudadDelEste, cidadeEhFozOuPuertoIguazu } from '@/lib/cidade-empresa'
import { avaliarAvisoChamarCorrida } from '@/lib/chamar-corrida-empresa'

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
  servicos_locais: { texto: 'FALAR NO WHATSAPP', icon: MessageCircle, cor: '#25D366', acao: 'whatsapp' },
  'Serviços Locais': { texto: 'FALAR NO WHATSAPP', icon: MessageCircle, cor: '#25D366', acao: 'whatsapp' },
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
 *   cidade?: string
 *   horarios?: Record<string, unknown>
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
  cidade = '',
  horarios = {},
  whatsapp = null,
  precoTicketInteira = 0,
  precoTicketMeia,
  precoDiaria = 0,
}) {
  const router = useRouter()
  const { perfilEhProfissional, recursosProfissionaisLiberados } = useProfissionalGate()
  const [showTicketPopup, setShowTicketPopup] = useState(false)
  const [showReservaPopup, setShowReservaPopup] = useState(false)
  const [showReservaMesaModal, setShowReservaMesaModal] = useState(false)
  const [dataMesa, setDataMesa] = useState('')
  const [horaMesa, setHoraMesa] = useState('')
  const [nPessoasMesa, setNPessoasMesa] = useState(2)

  useEffect(() => {
    if (!showReservaMesaModal) return
    const hoje = new Date().toISOString().slice(0, 10)
    setDataMesa((d) => (d ? d : hoje))
    setHoraMesa((t) => (t ? t : '12:00'))
  }, [showReservaMesaModal])

  const config = useMemo(() => {
    const base =
      botoesPorCategoria[categoria] || {
        texto: 'VER MAIS',
        icon: Package,
        cor: '#0097b2',
        acao: 'detalhes',
      }
    const cat = String(categoria || '')
    const loja = cat === 'Lojas' || cat === 'lojas'
    if (loja) {
      if (cidadeEhCiudadDelEste(cidade)) {
        return { ...base, texto: 'VER PRODUTOS', icon: ShoppingBag, cor: '#96CEB4', acao: 'produtos' }
      }
      if (cidadeEhFozOuPuertoIguazu(cidade)) {
        return { ...base, texto: 'CHAMAR CORRIDA', icon: Car, cor: '#FFEAA7', acao: 'corrida' }
      }
      return { texto: 'VER MAIS', icon: Package, cor: '#0097b2', acao: 'detalhes' }
    }
    return base
  }, [categoria, cidade])

  const Icon = config.icon

  const bloquearCorridaProfissional = () => {
    if (perfilEhProfissional && !recursosProfissionaisLiberados) {
      window.alert(
        'Mobilidade disponível após verificação dos documentos. Use Menu → USUÁRIO → Anexar Documentos.'
      )
      return true
    }
    return false
  }

  const irMobilidadeEmpresa = () => {
    if (bloquearCorridaProfissional()) return
    const aviso = avaliarAvisoChamarCorrida(horarios)
    if (!aviso.irDireto) {
      if (!window.confirm(aviso.mensagem)) return
    }
    router.push(`/mobilidade?destino_empresa=${encodeURIComponent(empresaId)}`)
  }

  const abrirWhatsappGastronomiaSimples = () => {
    const wa = whatsappWaUrl(whatsapp)
    if (!wa) {
      alert('WhatsApp da empresa não configurado.')
      return
    }
    const texto = `Olá! Gostaria de reservar uma mesa em ${empresaNome}.`
    window.open(`https://wa.me/${wa}?text=${encodeURIComponent(texto)}`, '_blank')
  }

  const confirmarReservaMesaWhatsapp = () => {
    const wa = whatsappWaUrl(whatsapp)
    if (!wa) {
      alert('WhatsApp da empresa não configurado.')
      return
    }
    const n = Math.max(1, Number(nPessoasMesa) || 1)
    const dataFmt = dataMesa?.trim() ? dataMesa.trim() : '(a combinar)'
    const horaFmt = horaMesa?.trim() ? horaMesa.trim() : '(a combinar)'
    const texto = `Olá! Gostaria de reservar uma mesa em ${empresaNome} para o dia ${dataFmt} às ${horaFmt} para ${n} pessoa(s).`
    window.open(`https://wa.me/${wa}?text=${encodeURIComponent(texto)}`, '_blank')
    setShowReservaMesaModal(false)
  }

  const abrirWhatsappServicosLocais = () => {
    const wa = whatsappWaUrl(whatsapp)
    if (!wa) {
      alert('WhatsApp da empresa não configurado.')
      return
    }
    const texto = `Olá! Vi ${empresaNome} no Guia 3F e gostaria de mais informações.`
    window.open(`https://wa.me/${wa}?text=${encodeURIComponent(texto)}`, '_blank')
  }

  const handleClick = () => {
    switch (config.acao) {
      case 'reserva':
        if (isHospedagem(categoria)) {
          setShowReservaPopup(true)
        } else if (isGastronomia(categoria)) {
          setShowReservaMesaModal(true)
        } else {
          abrirWhatsappGastronomiaSimples()
        }
        break
      case 'ticket':
        setShowTicketPopup(true)
        break
      case 'produtos':
        router.push(`/compras-paraguai/${empresaId}`)
        break
      case 'corrida':
        irMobilidadeEmpresa()
        break
      case 'whatsapp':
        abrirWhatsappServicosLocais()
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

      {showReservaMesaModal ? (
        <div
          className="fixed inset-0 z-[250] flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowReservaMesaModal(false)
          }}
          role="presentation"
        >
          <div
            className="w-full max-w-sm min-w-0 overflow-hidden rounded-xl bg-white p-4 text-gray-900 shadow-xl [color-scheme:light]"
            onClick={(ev) => ev.stopPropagation()}
            role="dialog"
            aria-labelledby="reserva-mesa-titulo"
          >
            <h3 id="reserva-mesa-titulo" className="text-lg font-bold text-gray-900">
              Dados da reserva
            </h3>
            <p className="mt-1 text-sm text-gray-700">Serão enviados no WhatsApp para a empresa.</p>
            <div className="mt-4 min-w-0 max-w-full space-y-4">
              <div className="min-w-0 max-w-full">
                <label htmlFor="reserva-mesa-data" className="mb-1 block text-sm font-medium text-gray-700">
                  Data
                </label>
                <input
                  id="reserva-mesa-data"
                  type="date"
                  value={dataMesa}
                  onChange={(e) => setDataMesa(e.target.value)}
                  className="box-border w-44 max-w-full rounded-lg border border-gray-300 bg-white p-2 text-sm text-gray-900"
                />
              </div>
              <div className="min-w-0 max-w-full">
                <label htmlFor="reserva-mesa-hora" className="mb-1 block text-sm font-medium text-gray-700">
                  Hora
                </label>
                <input
                  id="reserva-mesa-hora"
                  type="time"
                  value={horaMesa}
                  onChange={(e) => setHoraMesa(e.target.value)}
                  className="box-border w-44 max-w-full rounded-lg border border-gray-300 bg-white p-2 text-sm text-gray-900"
                />
              </div>
              <div className="min-w-0 max-w-full">
                <label htmlFor="reserva-mesa-pessoas" className="mb-1 block text-sm font-medium text-gray-700">
                  Nº de pessoas
                </label>
                <input
                  id="reserva-mesa-pessoas"
                  type="number"
                  min={1}
                  max={99}
                  value={nPessoasMesa}
                  onChange={(e) => setNPessoasMesa(Number(e.target.value))}
                  className="box-border w-44 max-w-full rounded-lg border border-gray-300 bg-white p-2 text-sm text-gray-900"
                />
              </div>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowReservaMesaModal(false)}
                className="rounded-lg bg-gray-200 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarReservaMesaWhatsapp}
                className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:opacity-95"
              >
                Abrir WhatsApp
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
