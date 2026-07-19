'use client'

import { useEffect, useMemo, useState } from 'react'
import { Ticket, Calendar, Car, Package, Utensils, Hotel, ShoppingBag, MessageCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import PopupCompraAtrativos from '@/components/PopupCompraAtrativos'
import DrawerReservaHospedagem from '@/components/DrawerReservaHospedagem'
import DrawerProdutosCde from '@/components/DrawerProdutosCde'
import {
  openWhatsAppChat,
  mensagemWhatsappReservaMesa,
  mensagemWhatsappReservaMesaSimples,
  mensagemWhatsappContatoGuia,
} from '@/lib/whatsapp-empresa'
import { useGateComprasReservas } from '@/lib/useGateComprasReservas'
import PopupAvisoBloqueioConta from '@/components/PopupAvisoBloqueioConta'
import { registrarUsoPreLiberacao } from '@/lib/registrarUsoPreLiberacao'
import { registrarCliqueBotaoDinamico } from '@/lib/botaoDinamicoCliques'
import { supabase } from '@/lib/supabase'
import { cidadeEhCiudadDelEste, cidadeEhFozOuPuertoIguazu } from '@/lib/cidade-empresa'
import { avaliarAvisoChamarCorrida } from '@/lib/chamar-corrida-empresa'
import { useModalScrollLock } from '@/lib/useModalScrollLock'

const COR_BOTAO_CHAMAR_CORRIDA = '#00D443'

const botoesPorCategoria = {
  gastronomia: { texto: 'RESERVAR MESA', icon: Utensils, cor: '#FF6B6B', acao: 'reserva' },
  Restaurantes: { texto: 'RESERVAR MESA', icon: Utensils, cor: '#FF6B6B', acao: 'reserva' },
  passeios: { texto: 'Comprar Ticket', icon: Ticket, cor: '#4ECDC4', acao: 'ticket', textoCompacto: true },
  Atrativos: { texto: 'Comprar Ticket', icon: Ticket, cor: '#4ECDC4', acao: 'ticket', textoCompacto: true },
  lojas: { texto: 'CATÁLOGO', icon: ShoppingBag, cor: '#00D443', acao: 'produtos' },
  Lojas: { texto: 'CATÁLOGO', icon: ShoppingBag, cor: '#00D443', acao: 'produtos' },
  hospedagem: { texto: 'FAZER RESERVA', icon: Hotel, cor: '#45B7D1', acao: 'reserva' },
  Hospedagem: { texto: 'FAZER RESERVA', icon: Hotel, cor: '#45B7D1', acao: 'reserva' },
  mobilidade: { texto: 'CHAMAR CORRIDA', icon: Car, cor: '#FFEAA7', acao: 'corrida' },
  eventos: { texto: 'COMPRAR INGRESSO', icon: Calendar, cor: '#DDA0DD', acao: 'ticket' },
  Eventos: { texto: 'COMPRAR INGRESSO', icon: Calendar, cor: '#DDA0DD', acao: 'ticket' },
  Mobilidade: { texto: 'CHAMAR CORRIDA', icon: Car, cor: '#FFEAA7', acao: 'corrida' },
  'Compras Paraguai': { texto: 'VER OFERTAS', icon: ShoppingBag, cor: '#F1C40F', acao: 'produtos' },
  servicos_locais: { texto: 'WhatsApp', icon: MessageCircle, cor: '#25D366', acao: 'whatsapp' },
  'Serviços Locais': { texto: 'WhatsApp', icon: MessageCircle, cor: '#25D366', acao: 'whatsapp' },
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
 *   empresaUsername?: string | null
 *   cidade?: string
 *   horarios?: Record<string, unknown>
 *   whatsapp?: string | null
 *   precoTicketInteira?: number
 *   precoTicketMeia?: number
 *   empresaFotoUrl?: string | null
 *   notaMedia?: number | null
 *   palavrasChave?: unknown
 *   abrirReservaAuto?: boolean
 * }} props
 */
export default function AbaBotaoDinamico({
  categoria,
  empresaId,
  empresaNome,
  empresaUsername = null,
  empresaFotoUrl = null,
  notaMedia = null,
  cidade = '',
  horarios = {},
  whatsapp = null,
  precoTicketInteira = 0,
  precoTicketMeia,
  palavrasChave = [],
  abrirReservaAuto = false,
}) {
  const router = useRouter()
  const {
    podeComprarReservar,
    avisarBloqueio,
    loading: gateLoading,
    mensagemBloqueio,
    tituloBloqueio,
    avisoAberto,
    fecharAvisoBloqueio,
  } = useGateComprasReservas()
  const [showTicketPopup, setShowTicketPopup] = useState(false)
  const [showReservaPopup, setShowReservaPopup] = useState(false)
  const [showProdutosPopup, setShowProdutosPopup] = useState(false)
  const [showReservaMesaModal, setShowReservaMesaModal] = useState(false)
  const [dataMesa, setDataMesa] = useState('')
  const [horaMesa, setHoraMesa] = useState('')
  const [nPessoasMesa, setNPessoasMesa] = useState(2)

  const popupDinamicoAberto =
    showReservaMesaModal || showTicketPopup || showReservaPopup || showProdutosPopup
  useModalScrollLock(popupDinamicoAberto)

  useEffect(() => {
    if (!abrirReservaAuto) return
    if (!isHospedagem(categoria)) return
    if (!podeComprarReservar && !gateLoading) return
    setShowReservaPopup(true)
  }, [abrirReservaAuto, categoria, podeComprarReservar, gateLoading])

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
        return { ...base, texto: 'CATÁLOGO', icon: ShoppingBag, cor: '#00D443', acao: 'produtos' }
      }
      if (cidadeEhFozOuPuertoIguazu(cidade)) {
        return {
          ...base,
          texto: 'CHAMAR CORRIDA',
          icon: Car,
          cor: COR_BOTAO_CHAMAR_CORRIDA,
          acao: 'corrida',
          textoCompacto: true,
        }
      }
      return { texto: 'VER MAIS', icon: Package, cor: '#0097b2', acao: 'detalhes' }
    }
    return base
  }, [categoria, cidade])

  const Icon = config.icon

  const bloqueadoNaAba = !gateLoading && !podeComprarReservar && Boolean(mensagemBloqueio)

  const irMobilidadeEmpresa = () => {
    const aviso = avaliarAvisoChamarCorrida(horarios)
    if (!aviso.irDireto) {
      if (!window.confirm(aviso.mensagem)) return
    }
    void registrarUsoPreLiberacao({
      tipo: 'mobilidade_corrida',
      descricao: `Mobilidade — destino ${empresaNome}`,
      empresaId,
    })
    router.push(`/mobilidade?destino_empresa=${encodeURIComponent(empresaId)}`)
  }

  const abrirWhatsappGastronomiaSimples = () => {
    if (!openWhatsAppChat(whatsapp, mensagemWhatsappReservaMesaSimples(empresaUsername))) {
      alert('WhatsApp da empresa não configurado.')
    }
  }

  const confirmarReservaMesaWhatsapp = () => {
    const n = Math.max(1, Number(nPessoasMesa) || 1)
    const dataFmt = dataMesa?.trim() || ''
    const horaFmt = horaMesa?.trim() || ''
    if (!dataFmt || !horaFmt) {
      alert('Preencha data e horário.')
      return
    }
    const texto = mensagemWhatsappReservaMesa({
      username: empresaUsername,
      data: dataFmt,
      horario: horaFmt,
      pessoas: n,
    })
    if (!openWhatsAppChat(whatsapp, texto)) {
      alert('WhatsApp da empresa não configurado.')
      return
    }
    void registrarUsoPreLiberacao({
      tipo: 'reserva_mesa',
      descricao: `Reserva mesa ${empresaNome}`,
      empresaId,
    })
    setShowReservaMesaModal(false)
  }

  const abrirWhatsappServicosLocais = () => {
    if (!openWhatsAppChat(whatsapp, mensagemWhatsappContatoGuia())) {
      alert('WhatsApp da empresa não configurado.')
    }
  }

  const handleClick = () => {
    if (!podeComprarReservar) {
      avisarBloqueio()
      return
    }
    void registrarCliqueBotaoDinamico(supabase, empresaId)
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
        setShowProdutosPopup(true)
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
        {bloqueadoNaAba ? (
          <div className="text-left">
            <p className="text-sm font-semibold text-[#001f3f]">{tituloBloqueio}</p>
            <p className="mt-2 text-sm leading-relaxed text-gray-700">{mensagemBloqueio}</p>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={handleClick}
              className={`w-full rounded-lg py-3 font-bold text-white transition-colors hover:opacity-90${
                config.textoCompacto ? ' text-sm tracking-tight' : ' text-base'
              }`}
              style={{ backgroundColor: config.cor }}
            >
              {config.texto}
            </button>
            <p className="mt-3 text-xs text-gray-400">Clique para {config.texto.toLowerCase()}</p>
          </>
        )}
      </div>

      <PopupAvisoBloqueioConta
        aberto={avisoAberto}
        onFechar={fecharAvisoBloqueio}
        titulo={tituloBloqueio}
        mensagem={mensagemBloqueio}
      />

      <PopupCompraAtrativos
        isOpen={showTicketPopup}
        onClose={() => setShowTicketPopup(false)}
        empresaId={empresaId}
        empresaNome={empresaNome}
        empresaUsername={empresaUsername}
        empresaFotoUrl={empresaFotoUrl}
        notaMedia={notaMedia}
        whatsappDestino={whatsapp}
      />

      <DrawerReservaHospedagem
        isOpen={showReservaPopup}
        onClose={() => setShowReservaPopup(false)}
        empresaId={empresaId}
        empresaNome={empresaNome}
        empresaUsername={empresaUsername}
        empresaFotoUrl={empresaFotoUrl}
        notaMedia={notaMedia}
      />

      <DrawerProdutosCde
        isOpen={showProdutosPopup}
        onClose={() => setShowProdutosPopup(false)}
        empresaId={empresaId}
        empresaNome={empresaNome}
        empresaUsername={empresaUsername}
        empresaFotoUrl={empresaFotoUrl}
        notaMedia={notaMedia}
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
            data-modal-scroll-lock-scrollable
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
                <span className="mb-1 block text-sm font-medium text-gray-700">Mesa para</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 text-lg font-bold"
                    onClick={() => setNPessoasMesa((n) => Math.max(1, n - 1))}
                    aria-label="Menos pessoas"
                  >
                    −
                  </button>
                  <span className="min-w-[2rem] text-center text-lg font-bold">{nPessoasMesa}</span>
                  <span className="text-sm text-gray-600">pessoas</span>
                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 text-lg font-bold"
                    onClick={() => setNPessoasMesa((n) => Math.min(30, n + 1))}
                    aria-label="Mais pessoas"
                  >
                    +
                  </button>
                </div>
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
