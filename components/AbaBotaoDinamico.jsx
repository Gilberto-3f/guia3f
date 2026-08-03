'use client'

import { useEffect, useMemo, useState } from 'react'
import { Ticket, Calendar, Car, Package, Utensils, Hotel, ShoppingBag, Wrench } from 'lucide-react'
import { useRouter } from '@/i18n/navigation'
import DrawerTicketsAtrativos from '@/components/DrawerTicketsAtrativos'
import DrawerReservaHospedagem from '@/components/DrawerReservaHospedagem'
import DrawerProdutosCde from '@/components/DrawerProdutosCde'
import DrawerCardapio from '@/components/DrawerCardapio'
import DrawerServicosLocais from '@/components/DrawerServicosLocais'
import { useGateComprasReservas } from '@/lib/useGateComprasReservas'
import PopupAvisoBloqueioConta from '@/components/PopupAvisoBloqueioConta'
import { registrarUsoPreLiberacao } from '@/lib/registrarUsoPreLiberacao'
import { registrarCliqueBotaoDinamico } from '@/lib/botaoDinamicoCliques'
import { supabase } from '@/lib/supabase'
import { empresaEhLojaComCatalogo } from '@/lib/cidade-empresa'
import { avaliarAvisoChamarCorrida } from '@/lib/chamar-corrida-empresa'
import { buildHrefChamarCorridaEmpresa } from '@/lib/mobilidadePesquisaParams'
import { useModalScrollLock } from '@/lib/useModalScrollLock'

const COR_BOTAO_CHAMAR_CORRIDA = '#00D443'

const botoesPorCategoria = {
  gastronomia: { texto: 'CARDÁPIO', icon: Utensils, cor: '#FF6B6B', acao: 'cardapio' },
  Restaurantes: { texto: 'CARDÁPIO', icon: Utensils, cor: '#FF6B6B', acao: 'cardapio' },
  passeios: { texto: 'TICKETS', icon: Ticket, cor: '#4ECDC4', acao: 'ticket' },
  Atrativos: { texto: 'TICKETS', icon: Ticket, cor: '#4ECDC4', acao: 'ticket' },
  lojas: { texto: 'CATÁLOGO', icon: ShoppingBag, cor: '#00D443', acao: 'produtos' },
  Lojas: { texto: 'CATÁLOGO', icon: ShoppingBag, cor: '#00D443', acao: 'produtos' },
  hospedagem: { texto: 'RESERVAS', icon: Hotel, cor: '#45B7D1', acao: 'reserva' },
  Hospedagem: { texto: 'RESERVAS', icon: Hotel, cor: '#45B7D1', acao: 'reserva' },
  mobilidade: { texto: 'CHAMAR CORRIDA', icon: Car, cor: '#FFEAA7', acao: 'corrida' },
  eventos: { texto: 'COMPRAR INGRESSO', icon: Calendar, cor: '#DDA0DD', acao: 'ticket' },
  Eventos: { texto: 'COMPRAR INGRESSO', icon: Calendar, cor: '#DDA0DD', acao: 'ticket' },
  Mobilidade: { texto: 'CHAMAR CORRIDA', icon: Car, cor: '#FFEAA7', acao: 'corrida' },
  'Compras Paraguai': { texto: 'VER OFERTAS', icon: ShoppingBag, cor: '#F1C40F', acao: 'produtos' },
  servicos_locais: { texto: 'SERVIÇOS', icon: Wrench, cor: '#00D443', acao: 'servicos' },
  'Serviços Locais': { texto: 'SERVIÇOS', icon: Wrench, cor: '#00D443', acao: 'servicos' },
}

function isHospedagem(cat) {
  return String(cat ?? '').toLowerCase().trim() === 'hospedagem'
}

function isGastronomia(cat) {
  const c = String(cat ?? '').toLowerCase().trim()
  return c === 'restaurantes' || c === 'gastronomia'
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
 *   empresaVerificada?: boolean | null
 *   palavrasChave?: unknown
 *   abrirReservaAuto?: boolean
 *   recomendacaoId?: string | null
 * }} props
 */
export default function AbaBotaoDinamico({
  categoria,
  empresaId,
  empresaNome,
  empresaUsername = null,
  empresaFotoUrl = null,
  notaMedia = null,
  empresaVerificada = null,
  cidade = '',
  horarios = {},
  whatsapp = null,
  precoTicketInteira = 0,
  precoTicketMeia,
  palavrasChave = [],
  abrirReservaAuto = false,
  recomendacaoId = null,
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
  const [showCardapioPopup, setShowCardapioPopup] = useState(false)
  const [showServicosPopup, setShowServicosPopup] = useState(false)

  const popupDinamicoAberto =
    showCardapioPopup || showTicketPopup || showReservaPopup || showProdutosPopup || showServicosPopup
  useModalScrollLock(popupDinamicoAberto)

  useEffect(() => {
    if (!abrirReservaAuto) return
    if (!isHospedagem(categoria)) return
    if (!podeComprarReservar && !gateLoading) return
    setShowReservaPopup(true)
  }, [abrirReservaAuto, categoria, podeComprarReservar, gateLoading])

  const config = useMemo(() => {
    if (isGastronomia(categoria)) {
      return { texto: 'CARDÁPIO', icon: Utensils, cor: '#FF6B6B', acao: 'cardapio' }
    }
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
      if (empresaEhLojaComCatalogo(cat, cidade)) {
        return { ...base, texto: 'CATÁLOGO', icon: ShoppingBag, cor: '#00D443', acao: 'produtos' }
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
    router.push(
      buildHrefChamarCorridaEmpresa({
        empresaId,
        nomeDestino: empresaNome,
      }),
    )
  }

  const handleClick = () => {
    if (!podeComprarReservar) {
      avisarBloqueio()
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
      case 'reserva':
        setShowReservaPopup(true)
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
        recomendacaoId={recomendacaoId}
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
    </>
  )
}
