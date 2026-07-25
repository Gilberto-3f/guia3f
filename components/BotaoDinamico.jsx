'use client'

import { useMemo, useState } from 'react'
import { Ticket, Calendar, Package, Utensils, ShoppingBag, Wrench } from 'lucide-react'
import { useRouter } from '@/i18n/navigation'
import { supabase } from '@/lib/supabase'
import DrawerTicketsAtrativos from '@/components/DrawerTicketsAtrativos'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'
import DrawerReservaHospedagem from '@/components/DrawerReservaHospedagem'
import DrawerProdutosCde from '@/components/DrawerProdutosCde'
import DrawerCardapio from '@/components/DrawerCardapio'
import DrawerServicosLocais from '@/components/DrawerServicosLocais'
import { useGateComprasReservas } from '@/lib/useGateComprasReservas'
import PopupAvisoBloqueioConta from '@/components/PopupAvisoBloqueioConta'
import { registrarUsoPreLiberacao } from '@/lib/registrarUsoPreLiberacao'
import { registrarCliqueBotaoDinamico } from '@/lib/botaoDinamicoCliques'
import { useModalScrollLock } from '@/lib/useModalScrollLock'
import { empresaEhLojaComCatalogo } from '@/lib/cidade-empresa'

// Cards de filtros: botão dinâmico sempre verde (página da empresa usa AbaBotaoDinamico com cores por segmento)
const COR_PADRAO = '#00D443'

/** Mesmas classes do botão "VISITAR PÁGINA" em CardAtrativo. */
const CLASSE_BOTAO_TEXTO =
  'text-xs font-extrabold leading-tight text-white whitespace-normal sm:text-sm'
/** Variante em uma linha (rótulos mais longos). */
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
 *   empresaFotoUrl?: string | null
 *   notaMedia?: number | null
 *   empresaVerificada?: boolean | null
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
  empresaVerificada = null,
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
  const [showServicosPopup, setShowServicosPopup] = useState(false)

  const popupDinamicoAberto =
    showCardapioPopup || showTicketPopup || showReservaPopup || showProdutosPopup || showServicosPopup
  useModalScrollLock(popupDinamicoAberto)

  // FIX: somente texto e ícone mudam por categoria/cidade
  const config = useMemo(() => {
    if (isGastronomia(categoria)) return { texto: 'CARDÁPIO', icon: Utensils, acao: 'cardapio' }
    if (isPasseios(categoria)) {
      return { texto: 'TICKETS', icon: Ticket, acao: 'ticket' }
    }
    if (isHospedagem(categoria)) return { texto: 'RESERVAS', icon: Calendar, acao: 'hospedagem' }
    if (isServicosLocais(categoria)) {
      return { texto: 'SERVIÇOS', icon: Wrench, acao: 'servicos' }
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
      case 'servicos':
        setShowServicosPopup(true)
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
          <DrawerCardapio
            isOpen={showCardapioPopup}
            onClose={() => setShowCardapioPopup(false)}
            empresaId={empresaId}
            empresaNome={empresaNome}
            empresaUsername={empresaUsername}
            empresaFotoUrl={empresaFotoUrl}
            notaMedia={notaMedia}
            empresaVerificada={empresaVerificada}
          />

          <DrawerServicosLocais
            isOpen={showServicosPopup}
            onClose={() => setShowServicosPopup(false)}
            empresaId={empresaId}
            empresaNome={empresaNome}
            empresaUsername={empresaUsername}
            empresaFotoUrl={empresaFotoUrl}
            notaMedia={notaMedia}
            empresaVerificada={empresaVerificada}
          />

          <DrawerTicketsAtrativos
            isOpen={showTicketPopup}
            onClose={() => setShowTicketPopup(false)}
            empresaId={empresaId}
            empresaNome={empresaNome}
            empresaUsername={empresaUsername}
            empresaFotoUrl={empresaFotoUrl}
            notaMedia={notaMedia}
            empresaVerificada={empresaVerificada}
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
            empresaVerificadaInicial={empresaVerificada}
          />
          <DrawerProdutosCde
            isOpen={showProdutosPopup}
            onClose={() => setShowProdutosPopup(false)}
            empresaId={empresaId}
            empresaNome={empresaNome}
            empresaUsername={empresaUsername}
            empresaFotoUrl={empresaFotoUrl}
            notaMedia={notaMedia}
            empresaVerificada={empresaVerificada}
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
