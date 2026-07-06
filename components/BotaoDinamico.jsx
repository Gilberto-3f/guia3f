'use client'

import { useMemo, useState } from 'react'
import { Ticket, Calendar, Car, Package, Utensils, ShoppingBag, MessageCircle, X } from 'lucide-react'
import { useRouter } from '@/i18n/navigation'
import { supabase } from '@/lib/supabase'
import PopupCompraTicket from '@/components/PopupCompraTicket'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'
import PopupReservaHospedagem from '@/components/PopupReservaHospedagem'
import { useGateComprasReservas } from '@/lib/useGateComprasReservas'
import PopupAvisoBloqueioConta from '@/components/PopupAvisoBloqueioConta'
import { registrarUsoPreLiberacao } from '@/lib/registrarUsoPreLiberacao'
import { registrarCliqueBotaoDinamico } from '@/lib/botaoDinamicoCliques'
import {
  openWhatsAppChat,
  mensagemWhatsappReservaMesa,
  mensagemWhatsappContatoGuia,
} from '@/lib/whatsapp-empresa'
import { useModalScrollLock } from '@/lib/useModalScrollLock'

// Cards de filtros: botão dinâmico sempre verde (página da empresa usa AbaBotaoDinamico com cores por segmento)
const COR_PADRAO = '#00D443'

/** Mesmas classes do botão "VISITAR PÁGINA" em CardAtrativo. */
const CLASSE_BOTAO_TEXTO =
  'text-xs font-extrabold leading-tight text-white whitespace-normal sm:text-sm'
/** Mesmo tamanho, forçando uma linha (ex.: Comprar Ticket). */
const CLASSE_BOTAO_TEXTO_UMA_LINHA =
  'text-xs font-extrabold leading-tight text-white whitespace-nowrap sm:text-sm'

function norm(s) {
  return String(s ?? '').toLowerCase().trim()
}

function isHospedagem(cat) {
  const c = norm(cat)
  return c === 'hospedagem'
}

function isGastronomia(cat) {
  const c = norm(cat)
  return c === 'restaurantes' || c === 'gastronomia'
}

function isPasseios(cat) {
  const c = norm(cat)
  return c === 'atrativos' || c === 'passeios'
}

function isLojas(cat) {
  const c = norm(cat)
  return c === 'lojas'
}

function isServicosLocais(cat) {
  const c = norm(cat)
  return c === 'servicos_locais' || c === 'serviços locais' || c === 'servicos locais'
}

/**
 * @param {{
 *   categoria: string
 *   cidade?: string
 *   empresaId?: string
 *   empresaNome?: string
 *   empresaUsername?: string | null
 *   whatsapp?: string | null
 *   precoTicketInteira?: number
 *   precoTicketMeia?: number
 *   precoDiaria?: number
 *   palavrasChave?: unknown
 *   onClick?: (e: { stopPropagation: () => void }) => void
 * }} props
 */
export default function BotaoDinamico({
  categoria,
  cidade = '',
  empresaId = '',
  empresaNome = '',
  empresaUsername = null,
  whatsapp = null,
  precoTicketInteira = 0,
  precoTicketMeia,
  precoDiaria = 0,
  palavrasChave = [],
  onClick,
}) {
  const router = useRouter()
  const { podeInteragir, notificarSomenteLeitura } = useModoApresentacao()
  const {
    podeComprarReservar,
    avisarBloqueio,
    avisoAberto,
    fecharAvisoBloqueio,
    mensagemBloqueio,
    tituloBloqueio,
  } = useGateComprasReservas()
  const [showTicketPopup, setShowTicketPopup] = useState(false)
  const [showReservaPopup, setShowReservaPopup] = useState(false)
  const [showReservaMesaModal, setShowReservaMesaModal] = useState(false)
  const [reservaData, setReservaData] = useState('')
  const [reservaHora, setReservaHora] = useState('')
  const [reservaPessoas, setReservaPessoas] = useState(2)

  const popupDinamicoAberto = showReservaMesaModal || showTicketPopup || showReservaPopup
  useModalScrollLock(popupDinamicoAberto)

  // FIX: somente texto e ícone mudam por categoria/cidade
  const config = useMemo(() => {
    if (isGastronomia(categoria)) return { texto: 'RESERVAR MESA', icon: Utensils, acao: 'reserva_mesa' }
    if (isPasseios(categoria)) {
      return { texto: 'Comprar Ticket', icon: Ticket, acao: 'ticket', textoUmaLinha: true }
    }
    if (isHospedagem(categoria)) return { texto: 'FAZER RESERVA', icon: Calendar, acao: 'hospedagem' }
    if (isServicosLocais(categoria)) return { texto: 'WhatsApp', icon: MessageCircle, acao: 'whatsapp' }

    if (isLojas(categoria)) {
      const c = norm(cidade)
      const ehCde = c.includes('ciudad del este')
      return ehCde
        ? { texto: 'VER PRODUTOS', icon: ShoppingBag, acao: 'produtos' }
        : { texto: 'CHAMAR CORRIDA', icon: Car, acao: 'corrida', textoUmaLinha: true }
    }

    return { texto: 'VER MAIS', icon: Package, acao: 'detalhes' }
  }, [categoria, cidade])

  const Icon = config.icon
  const corBotao = COR_PADRAO

  const enviarWhatsappReservaMesa = () => {
    const d = reservaData.trim()
    const h = reservaHora.trim()
    if (!d || !h) {
      alert('Preencha data e horário.')
      return
    }
    const texto = mensagemWhatsappReservaMesa({
      username: empresaUsername,
      data: d,
      horario: h,
      pessoas: reservaPessoas,
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

  const executarAcao = () => {
    if (!podeInteragir) {
      notificarSomenteLeitura()
      return
    }
    if (!podeComprarReservar) {
      avisarBloqueio()
      return
    }
    if (!empresaId) {
      return
    }

    void registrarCliqueBotaoDinamico(supabase, empresaId)

    switch (config.acao) {
      case 'reserva_mesa':
        setShowReservaMesaModal(true)
        break
      case 'ticket':
        setShowTicketPopup(true)
        break
      case 'produtos':
        router.push(`/compras-paraguai/${empresaId}`)
        break
      case 'corrida':
        void registrarUsoPreLiberacao({
          tipo: 'mobilidade_corrida',
          descricao: `Mobilidade — destino ${empresaNome}`,
          empresaId,
        })
        router.push(`/mobilidade?destino=${encodeURIComponent(empresaId)}`)
        break
      case 'hospedagem':
        setShowReservaPopup(true)
        break
      case 'whatsapp':
        abrirWhatsappServicosLocais()
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
        className={`flex min-h-[3.25rem] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-center transition-opacity hover:opacity-95 ${
          config.textoUmaLinha ? CLASSE_BOTAO_TEXTO_UMA_LINHA : CLASSE_BOTAO_TEXTO
        }`}
        style={{ backgroundColor: corBotao }}
      >
        <Icon size={20} className="shrink-0 text-white" aria-hidden />
        <span className="max-w-full">{config.texto}</span>
      </button>

      {empresaId ? (
        <>
          {/* ADD: modal de reserva (gastronomia) */}
          {showReservaMesaModal ? (
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
              role="dialog"
              aria-modal="true"
              onClick={(e) => {
                if (e.target === e.currentTarget) setShowReservaMesaModal(false)
              }}
            >
              <div
                className="w-full min-w-0 max-w-sm overflow-hidden rounded-2xl bg-white p-5 shadow-xl [color-scheme:light]"
                data-modal-scroll-lock-scrollable
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-extrabold text-gray-900">Reservar Mesa</h3>
                    <p className="mt-1 text-xs text-gray-500">Reserva será feita pelo WhatsApp</p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                    onClick={() => setShowReservaMesaModal(false)}
                    aria-label="Fechar"
                  >
                    <X size={18} aria-hidden />
                  </button>
                </div>

                <div className="mt-4 min-w-0 space-y-3">
                  <div className="w-2/3 min-w-0 max-w-full">
                    <label className="block text-xs font-semibold text-gray-700">Data</label>
                    <input
                      type="date"
                      value={reservaData}
                      onChange={(e) => setReservaData(e.target.value)}
                      className="mt-1 box-border w-full min-w-0 max-w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0097b2]"
                    />
                  </div>
                  <div className="w-2/3 min-w-0 max-w-full">
                    <label className="block text-xs font-semibold text-gray-700">Horário</label>
                    <input
                      type="time"
                      value={reservaHora}
                      onChange={(e) => setReservaHora(e.target.value)}
                      className="mt-1 box-border w-full min-w-0 max-w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0097b2]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700">Mesa para</label>
                    <div className="mt-1 flex items-center gap-3">
                      <button
                        type="button"
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 text-lg font-bold text-gray-700"
                        onClick={() => setReservaPessoas((n) => Math.max(1, n - 1))}
                        aria-label="Menos pessoas"
                      >
                        −
                      </button>
                      <span className="min-w-[2rem] text-center text-lg font-bold text-gray-900">{reservaPessoas}</span>
                      <span className="text-sm text-gray-600">pessoas</span>
                      <button
                        type="button"
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 text-lg font-bold text-gray-700"
                        onClick={() => setReservaPessoas((n) => Math.min(30, n + 1))}
                        aria-label="Mais pessoas"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex gap-2">
                  <button
                    type="button"
                    className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    onClick={() => setShowReservaMesaModal(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#00D443] py-2.5 text-sm font-extrabold text-white hover:opacity-95"
                    onClick={enviarWhatsappReservaMesa}
                  >
                    <MessageCircle size={18} className="shrink-0 text-white" aria-hidden />
                    WhatsApp
                  </button>
                </div>
              </div>
            </div>
          ) : null}

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
            precoDiaria={precoDiaria}
            palavrasChave={palavrasChave}
            exibirPalavrasChave={isHospedagem(categoria)}
          />
        </>
      ) : null}

      <PopupAvisoBloqueioConta
        aberto={avisoAberto}
        onFechar={fecharAvisoBloqueio}
        titulo={tituloBloqueio}
        mensagem={mensagemBloqueio}
      />
    </>
  )
}
