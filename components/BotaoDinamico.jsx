'use client'

import { useMemo, useState } from 'react'
import { Ticket, Calendar, Package, Utensils, ShoppingBag, MessageCircle } from 'lucide-react'
import { useRouter } from '@/i18n/navigation'
import { supabase } from '@/lib/supabase'
import DrawerTicketsAtrativos from '@/components/DrawerTicketsAtrativos'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'
import DrawerReservaHospedagem from '@/components/DrawerReservaHospedagem'
import DrawerProdutosCde from '@/components/DrawerProdutosCde'
import DrawerCardapio from '@/components/DrawerCardapio'
import { useGateComprasReservas } from '@/lib/useGateComprasReservas'
import PopupAvisoBloqueioConta from '@/components/PopupAvisoBloqueioConta'
import { registrarUsoPreLiberacao } from '@/lib/registrarUsoPreLiberacao'
import { registrarCliqueBotaoDinamico } from '@/lib/botaoDinamicoCliques'
import { openWhatsAppChat, mensagemWhatsappContatoGuia } from '@/lib/whatsapp-empresa'
import { useModalScrollLock } from '@/lib/useModalScrollLock'
import { empresaEhLojaComCatalogo } from '@/lib/cidade-empresa'

// Cards de filtros: botão dinâmico sempre verde (página da empresa usa AbaBotaoDinamico com cores por segmento)
const COR_PADRAO = '#00D443'

/** Mesmas classes do botão "VISITAR PÁGINA" em CardAtrativo. */
const CLASSE_BOTAO_TEXTO =
  'text-xs font-extrabold leading-tight text-white whitespace-normal sm:text-sm'
/** Mesmo tamanho, forçando uma linha (ex.: Comprar Ticket). */
const CLASSE_BOTAO_TEXTO_UMA_LINHA =
  'text-xs font-extrabold leading-tight text-white whitespace-nowrap sm:text-sm'
/** Serviços Locais — rótulo WhatsApp um pouco maior. */
const CLASSE_BOTAO_TEXTO_WHATSAPP =
  'text-sm font-extrabold leading-tight text-white whitespace-nowrap sm:text-base'

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
 *   empresaFotoUrl?: string | null
 *   notaMedia?: number | null
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
  empresaFotoUrl = null,
  notaMedia = null,
  whatsapp = null,
  precoTicketInteira = 0,
  precoTicketMeia,
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
  const [showProdutosPopup, setShowProdutosPopup] = useState(false)
  const [showCardapioPopup, setShowCardapioPopup] = useState(false)

  const popupDinamicoAberto = showCardapioPopup || showTicketPopup || showReservaPopup || showProdutosPopup
  useModalScrollLock(popupDinamicoAberto)

  // FIX: somente texto e ícone mudam por categoria/cidade
  const config = useMemo(() => {
    if (isGastronomia(categoria)) return { texto: 'CARDÁPIO', icon: Utensils, acao: 'cardapio' }
    if (isPasseios(categoria)) {
      return { texto: 'Comprar Ticket', icon: Ticket, acao: 'ticket', textoUmaLinha: true }
    }
    if (isHospedagem(categoria)) return { texto: 'FAZER RESERVA', icon: Calendar, acao: 'hospedagem' }
    if (isServicosLocais(categoria)) {
      return { texto: 'WhatsApp', icon: MessageCircle, acao: 'whatsapp', textoWhatsapp: true }
    }

    if (isLojas(categoria)) {
      return empresaEhLojaComCatalogo(categoria, cidade)
        ? { texto: 'CATÁLOGO', icon: ShoppingBag, acao: 'produtos' }
        : { texto: 'VER MAIS', icon: Package, acao: 'detalhes' }
    }

    return { texto: 'VER MAIS', icon: Package, acao: 'detalhes' }
  }, [categoria, cidade])

  const Icon = config.icon
  const corBotao = COR_PADRAO

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
      case 'cardapio':
        setShowCardapioPopup(true)
        break
      case 'ticket':
        setShowTicketPopup(true)
        break
      case 'produtos':
        setShowProdutosPopup(true)
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
          config.textoWhatsapp
            ? CLASSE_BOTAO_TEXTO_WHATSAPP
            : config.textoUmaLinha
              ? CLASSE_BOTAO_TEXTO_UMA_LINHA
              : CLASSE_BOTAO_TEXTO
        }`}
        style={{ backgroundColor: corBotao }}
      >
        <Icon size={20} className="shrink-0 text-white" aria-hidden />
        <span className="max-w-full">{config.texto}</span>
      </button>

      {empresaId ? (
        <>
          <DrawerCardapio
            isOpen={showCardapioPopup}
            onClose={() => setShowCardapioPopup(false)}
            empresaId={empresaId}
            empresaNome={empresaNome}
            empresaUsername={empresaUsername}
            empresaFotoUrl={empresaFotoUrl}
            notaMedia={notaMedia}
          />

          <DrawerTicketsAtrativos
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
