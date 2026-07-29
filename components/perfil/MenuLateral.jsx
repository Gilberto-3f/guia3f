'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Bookmark,
  Building2,
  CalendarDays,
  Car,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  DollarSign,
  Handshake,
  History,
  KeyRound,
  Images,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  MousePointerClick,
  Eye,
  Paperclip,
  Scale,
  Search,
  Settings,
  Shield,
  ShoppingBag,
  Speaker,
  Star,
  Table,
  User,
  Users,
  Home,
  Hotel,
  X,
  ArrowRight,
  ArrowLeftRight,
} from 'lucide-react'
import { useRouter } from '@/i18n/navigation'
import { signOutCurrentDevice } from '@/lib/authCookieSync'
import { supabase } from '@/lib/supabase'
import { buscarUsuarioCached, invalidarCacheUsuarioSession } from '@/lib/usuarioSessionCache'
import { useInfracoes } from '@/app/[locale]/(admin)/dashboard/admin/hooks/useInfracoes'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'
import { useAdminColaboradorModo } from '@/context/AdminColaboradorModoContext'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import { useAnfitriaoModo } from '@/context/AnfitriaoModoContext'
import { empresaDocumentosEnviados } from '@/lib/faseVerificacaoConta'
import { useEmpresaServicosPlano } from '@/hooks/useEmpresaServicosPlano'
import { menuEmpresaLiberado, menuEmpresaVisivel } from '@/lib/planosEmpresaServicosGate'
import BotaoInfoPopup from '@/components/ui/BotaoInfoPopup'
import { textoInfoDrawer } from '@/lib/drawerInfoTextos'
import {
  historyTemMenuLateralAberto,
  limparFlagHistoryMenuLateral,
  marcarReabrirMenuLateral,
  MENU_LATERAL_HISTORY_FLAG,
} from '@/lib/menuLateralHistory'
import { contarNaoLidasChatAdmMembro } from '@/lib/ecossistemaConversas'
import { GUIA_CHAT_ADM_BADGE_EVENT } from '@/lib/chat-adm-badge-events'

import EmergenciaItemEsquecido from '@/components/perfil/subpaginas/emergencia/EmergenciaItemEsquecido'
import EmergenciaSocorro from '@/components/perfil/subpaginas/emergencia/EmergenciaSocorro'
import EmergenciaMensageiroAdm from '@/components/perfil/subpaginas/emergencia/EmergenciaMensageiroAdm'
import EmergenciaPreLiberacao from '@/components/perfil/subpaginas/emergencia/EmergenciaPreLiberacao'
import { prefetchMinhasAtividades } from '@/lib/fetchMinhasAtividades'
import { prefetchComissoesOfertas } from '@/lib/fetchComissoesOfertas'
import EditarPerfil from '@/components/perfil/subpaginas/EditarPerfil'
import MeuHistorico from '@/components/perfil/subpaginas/MeuHistorico'
import HistoricoCompras from '@/components/perfil/subpaginas/HistoricoCompras'
import MinhasAtividades from '@/components/perfil/subpaginas/MinhasAtividades'
import PostIsoladoDrawer from '@/components/perfil/subpaginas/PostIsoladoDrawer'
import Configuracoes from '@/components/perfil/subpaginas/Configuracoes'
import RegrasEcossistema from '@/components/perfil/subpaginas/RegrasEcossistema'
import Comissoes from '@/components/perfil/subpaginas/Comissoes'
import AgendamentoAutomatico from '@/components/perfil/subpaginas/AgendamentoAutomatico'
import TabelaValores from '@/components/perfil/subpaginas/TabelaValores'
import MeusManifestos from '@/components/perfil/subpaginas/MeusManifestos'
import EditarPaginaEmpresa from '@/components/perfil/subpaginas/EditarPaginaEmpresa'
import CalendarioReservasHospedagem from '@/components/perfil/subpaginas/CalendarioReservasHospedagem'
import CadastrarHospedagemAnfitriao from '@/components/perfil/subpaginas/CadastrarHospedagemAnfitriao'
import HistoricoDecisoes from '@/components/perfil/subpaginas/HistoricoDecisoes'
import HistoricoStories from '@/components/perfil/subpaginas/HistoricoStories'
import SalvosDrawer from '@/components/perfil/subpaginas/SalvosDrawer'
import ModoApresentacao from '@/components/perfil/subpaginas/ModoApresentacao'
import AuxiliarAdmEmpresas from '@/components/perfil/subpaginas/AuxiliarAdmEmpresas'
import NomeComVerificacao from '@/components/NomeComVerificacao'
import AvatarImage from '@/components/AvatarImage'
import { contaVerificadaDocumentacao } from '@/lib/contaVerificada'
import AnexarDocumentos from '@/components/perfil/subpaginas/AnexarDocumentos'
import AnexarDocumentosTurista from '@/components/perfil/subpaginas/AnexarDocumentosTurista'
import AnexarDocumentosEmpresa from '@/components/perfil/subpaginas/AnexarDocumentosEmpresa'
import HistoricoManifestos from '@/components/perfil/subpaginas/HistoricoManifestos'
import RecomendacoesFeitas from '@/components/perfil/subpaginas/RecomendacoesFeitas'
import ParceriasProfissional from '@/components/perfil/subpaginas/ParceriasProfissional'
import VisitantesPerfil from '@/components/perfil/subpaginas/VisitantesPerfil'
import { contarVisitasPerfilPendentes } from '@/lib/perfilVisitas'
import { contarComprasTuristaPendentes } from '@/lib/turistaCompras'
import AvisoDocsProfissionalBloqueado from '@/components/AvisoDocsProfissionalBloqueado'
import AvisoPlanoEmpresaBloqueado from '@/components/empresa/AvisoPlanoEmpresaBloqueado'
import {
  GRUPOS_MENU_PROF_BLOQUEADOS_DOCS,
  SUBGRUPOS_MENU_PROF_BLOQUEADOS_DOCS,
  subpaginaProfissionalBloqueadaPorDocs,
} from '@/lib/profissionalDocsBloqueado'

/**
 * @typedef {{ tipo: 'menu', titulo: string, itens: MenuItem[] } | { tipo: 'pagina', titulo: string, id: string, historicoTipo?: string, postId?: string, comentarioId?: string | null }} HistoricoEntry
 */

/**
 * @typedef {{
 *   Icon: import('react').ComponentType<{ className?: string, size?: number }>
 *   label: string
 *   subpagina?: string
 *   href?: string
 *   badge?: number
 *   acao?: 'logout'
 *   subitens?: MenuItem[]
 *   condicional?: (ctx: MenuContext) => boolean
 * }} MenuItem
 */

/**
 * @typedef {{
 *   variant: 'turista' | 'profissional' | 'empresa' | 'admin'
 *   placaVermelha: boolean
 *   adminLevel: number
 *   recursosProfissionaisLiberados: boolean
 *   empresaCategoria?: string
 *   empresaCidade?: string
 *   empresaServicos?: string[]
 *   somenteAnfitriao?: boolean
 *   anfitriaoModoHospedagem?: boolean
 * }} MenuContext
 */

const itemConfig = /** @type {const} */ {
  Icon: Settings,
  label: 'Configurações',
  subpagina: 'configuracoes',
}

const itemChatAdm = /** @type {const} */ { Icon: MessageSquare, label: 'Chat ADM', href: '/chat-adm' }

/** @param {MenuItem} item */
function itemEhChatAdm(item) {
  return item.href === '/chat-adm'
}

const itemSair = /** @type {const} */ { label: 'Sair', acao: 'logout' }

/** Ícones dos subgrupos dentro de Aplicativo. */
const ICONE_SUBGRUPO = {
  'aplic-pessoal': User,
  'aplic-prof-hist': Star,
}

function empresaMenuHospedagemVisivel(ctx) {
  if (Boolean(ctx.somenteAnfitriao)) return true
  return String(ctx.empresaCategoria ?? '').trim() === 'Hospedagem'
}

/** Botão Dinâmico: liberado pelo plano (lojas CDE e BR/AR usam catálogo). */
function empresaBotaoDinamicoVisivel(ctx) {
  return menuEmpresaLiberado('botao-dinamico', ctx.empresaServicos ?? [])
}

function empresaMenuServico(id) {
  return (ctx) => menuEmpresaLiberado(id, ctx.empresaServicos ?? [])
}

function empresaMenuVisivel(id) {
  return (ctx) => menuEmpresaVisivel(id, ctx.empresaServicos ?? [])
}

/**
 * @param {MenuItem[]} itens
 * @param {MenuContext} ctx
 * @returns {MenuItem[]}
 */
function filtrarMenu(itens, ctx) {
  return itens.filter((item) => (item.condicional ? item.condicional(ctx) : true))
}

const itemHistoricoCompras = { Icon: History, label: 'Histórico de Compras', subpagina: 'historico-compras' }

const histComprasSubitensGeral = () => [
  { Icon: Handshake, label: 'Parcerias', subpagina: 'parcerias' },
  { Icon: Speaker, label: 'Recomendações', subpagina: 'recomendacoes' },
  { Icon: Car, label: 'Contratações', subpagina: 'contratacoes' },
  { Icon: ShoppingBag, label: 'Compras', subpagina: 'compras' },
]

function itensMinhaConta(ctx) {
  const base = [
    { Icon: Activity, label: 'Minhas Atividades', subpagina: 'minhas-atividades' },
    { Icon: History, label: 'Histórico de Stories', subpagina: 'historico-stories' },
    { Icon: Eye, label: 'Visitantes do Perfil', subpagina: 'visitantes-perfil' },
    {
      Icon: Bookmark,
      label: 'Publicações Salvas',
      subpagina: 'salvos',
      /** Empresa não tem feed nem salva mini-cards. */
      condicional: (c) => c.variant !== 'empresa',
    },
  ]

  return ctx ? filtrarMenu(base, ctx) : base
}

function secaoMinhaConta(ctx) {
  return { tipo: 'grupo', key: 'minha-conta', label: 'Minha Conta', items: itensMinhaConta(ctx) }
}

/**
 * @param {MenuItem[]} itensPrincipais
 */
function secaoUsuario(itensPrincipais) {
  return {
    tipo: 'grupo',
    key: 'usuario',
    label: 'Usuário',
    items: itensPrincipais,
  }
}


/**
 * @param {{ mostrarPreLiberacao?: boolean }} [opts]
 */
function secoesTurista(opts = {}) {
  const mostrarPreLiberacao = opts.mostrarPreLiberacao !== false
  const gEmergencia = [
    { Icon: Search, label: 'Item esquecido', subpagina: 'emergencia-item-esquecido' },
    { Icon: AlertTriangle, label: 'SOCORRO', subpagina: 'emergencia-socorro' },
    { Icon: MessageSquare, label: 'Chat ADM', href: '/chat-adm' },
  ]
  const gUsuario = [
    { Icon: User, label: 'Editar Perfil', subpagina: 'editar-perfil' },
    { Icon: Paperclip, label: 'Anexar Documentos', subpagina: 'anexar-documentos-turista' },
    ...(mostrarPreLiberacao
      ? [{ Icon: KeyRound, label: 'Pré-liberação de Cadastro', subpagina: 'emergencia-pre-liberacao' }]
      : []),
  ]
  const gAplic = [
    itemHistoricoCompras,
    { Icon: Scale, label: 'Denúncias e Decisões', subpagina: 'historico-decisoes' },
    itemConfig,
  ]
  return [
    secaoUsuario(gUsuario),
    secaoMinhaConta({ variant: 'turista', placaVermelha: false, adminLevel: 0, recursosProfissionaisLiberados: false }),
    { tipo: 'grupo', key: 'aplicativo', label: 'Aplicativo', items: gAplic },
    /** @type {const} */ { tipo: 'grupo', key: 'emergencia', label: 'Emergência', items: gEmergencia },
    { tipo: 'sair' },
  ]
}

/**
 * @param {MenuContext} ctx
 */
function pastaAnfitriao(ctx) {
  return {
    tipo: 'grupo',
    key: 'anfitriao',
    label: 'Anfitrião',
    items: [
      { Icon: Home, label: 'Anfitrião', subpagina: 'anfitriao-modo-social' },
      {
        Icon: Hotel,
        label: 'Hospedagem',
        subpagina: ctx.empresaHospedagemId ? 'anfitriao-modo-hospedagem' : 'cadastrar-hospedagem-anfitriao',
      },
    ],
  }
}

/** Pasta Anfitrião fixa + seções de empresa (modo Hospedagem). Sem “Sair”: logout só no perfil social. */
function secoesAnfitriaoComEmpresa(ctx) {
  const emp = secoesEmpresa(ctx).filter((s) => s.tipo !== 'sair')
  const idxEmp = emp.findIndex((s) => s.tipo === 'grupo' && s.key === 'empresa')
  if (idxEmp >= 0) {
    return [pastaAnfitriao(ctx), ...emp.slice(0, idxEmp), ...emp.slice(idxEmp)]
  }
  return [pastaAnfitriao(ctx), ...emp]
}

/**
 * @param {MenuContext} ctx
 */
function secoesProfissional(ctx) {
  const gUsuario = filtrarMenu(
    [
      { Icon: User, label: 'Editar Perfil', subpagina: 'editar-perfil' },
      { Icon: Paperclip, label: 'Anexar Documentos', subpagina: 'anexar-documentos' },
    ],
    ctx
  )
  const gPro = filtrarMenu(
    [
      { Icon: DollarSign, label: 'Comissões', subpagina: 'comissoes' },
      {
        Icon: ClipboardList,
        label: 'Manifesto',
        href: '/profissional/manifesto',
        condicional: (c) => c.placaVermelha === true,
      },
      {
        Icon: Table,
        label: 'Serviços Tabelados',
        subpagina: 'tabela',
        condicional: (c) => c.placaVermelha === true,
      },
      {
        Icon: CalendarDays,
        label: 'Agendamento',
        subpagina: 'agendamento',
        condicional: (c) => c.placaVermelha === true,
      },
      { Icon: Handshake, label: 'Parcerias Fechadas', subpagina: 'parcerias-prof' },
    ],
    ctx
  )
  const aplicSubgrupos = [
    {
      key: 'aplic-pessoal',
      label: 'Histórico Pessoal',
      items: [
        { Icon: History, label: 'Minhas Compras', subpagina: 'historico-compras' },
        { Icon: Scale, label: 'Denúncias e Decisões', subpagina: 'historico-decisoes' },
      ],
    },
    {
      key: 'aplic-prof-hist',
      label: 'Históricos de Trabalho',
      items: filtrarMenu(
        [
          {
            Icon: ClipboardList,
            label: 'Manifestos Concluídos',
            subpagina: 'historico-manifestos',
            condicional: (c) => c.placaVermelha === true,
          },
          { Icon: Speaker, label: 'Recomendações', subpagina: 'recomendacoes' },
        ],
        ctx
      ),
    },
  ]
  return [
    ...(ctx.ehAnfitriao ? [pastaAnfitriao(ctx)] : []),
    secaoUsuario(gUsuario),
    secaoMinhaConta(ctx),
    /** @type {const} */ { tipo: 'grupo', key: 'profissional', label: 'Profissional', items: gPro },
    {
      tipo: 'grupo',
      key: 'aplicativo',
      label: 'Aplicativo',
      subgrupos: aplicSubgrupos,
      items: [itemConfig],
    },
    { tipo: 'sair' },
  ]
}

/**
 * Profissional com documentos pendentes: mesmos itens do turista + Anexar Documentos;
 * pastas Profissional e Históricos de Trabalho ficam bloqueadas (aviso ao expandir).
 * @param {MenuContext} ctx
 */
function secoesProfissionalAguardandoDocs(ctx) {
  const turista = secoesTurista()
  const gAplicTurista = turista.find((s) => s.tipo === 'grupo' && s.key === 'aplicativo')

  return [
    secaoUsuario(
      filtrarMenu(
        [
          { Icon: User, label: 'Editar Perfil', subpagina: 'editar-perfil' },
          { Icon: Paperclip, label: 'Anexar Documentos', subpagina: 'anexar-documentos' },
        ],
        ctx
      )
    ),
    secaoMinhaConta(ctx),
    { tipo: 'grupo', key: 'profissional', label: 'Profissional', items: [] },
    {
      tipo: 'grupo',
      key: 'aplicativo',
      label: 'Aplicativo',
      subgrupos: [{ key: 'aplic-prof-hist', label: 'Históricos de Trabalho', items: [] }],
      items: filtrarMenu(gAplicTurista?.items ?? [itemConfig], ctx),
    },
    { tipo: 'sair' },
  ]
}

/**
 * @param {MenuContext} ctx
 */
function secoesEmpresa(ctx) {
  const gUsuario = [
    { Icon: Building2, label: 'Editar Página', subpagina: 'editar-pagina' },
    { Icon: Paperclip, label: 'Anexar documentos', subpagina: 'anexar-documentos-empresa' },
  ]
  const gEmpItems = [
      {
        Icon: Images,
        label: 'Rede Social',
        href: '/empresa/menu/feed-stories',
        condicional: empresaMenuServico('feed-stories'),
      },
      {
        Icon: MousePointerClick,
        label: 'Botão Dinâmico',
        href: '/empresa/menu/botao-dinamico',
        condicional: empresaBotaoDinamicoVisivel,
      },
      {
        Icon: CalendarDays,
        label: 'Calendário de Reservas',
        href: '/empresa/menu/calendario-reservas',
        condicional: empresaMenuHospedagemVisivel,
      },
      {
        Icon: Megaphone,
        label: 'Publicidade',
        href: '/empresa/menu/publicidade',
        condicional: (ctx) =>
          !ctx.somenteAnfitriao &&
          !ctx.anfitriaoModoHospedagem &&
          empresaMenuVisivel('publicidade')(ctx),
      },
      {
        Icon: Shield,
        label: 'Auxiliar ADM',
        href: '/empresa/menu/auxiliar-adm',
        condicional: (ctx) =>
          !ctx.somenteAnfitriao &&
          !ctx.anfitriaoModoHospedagem &&
          empresaMenuServico('auxiliar-adm')(ctx),
      },
      {
        Icon: DollarSign,
        label: 'Cadastrar Comissão',
        href: '/empresa/menu/cadastrar-comissao',
        condicional: empresaMenuServico('cadastrar-comissao'),
      },
      {
        Icon: MessageSquare,
        label: 'Chat ADM',
        href: '/chat-adm',
        condicional: empresaMenuServico('chat-adm'),
      },
    ]
  const gAplic = [
    { Icon: Scale, label: 'Denúncias e Decisões', subpagina: 'historico-decisoes' },
    itemConfig,
  ]
  return [
    secaoUsuario(gUsuario),
    secaoMinhaConta(ctx),
    { tipo: 'grupo', key: 'empresa', label: 'Empresa', items: gEmpItems },
    { tipo: 'grupo', key: 'aplicativo', label: 'Aplicativo', items: gAplic },
    { tipo: 'sair' },
  ]
}

function secaoAdminColaborador(adminLevelN, { emModoAdm, temModoDual }) {
  const nivel = Number(adminLevelN ?? 0)
  if (nivel < 2) return null

  /** @type {MenuItem[]} */
  const items = []

  if (nivel === 2 || nivel === 3) {
    if (temModoDual && emModoAdm) {
      items.push({ Icon: LayoutDashboard, label: 'Dashboard ADM', href: '/dashboard/admin' })
    }
    if (temModoDual) {
      items.push({
        Icon: ArrowLeftRight,
        label: emModoAdm ? 'Modo Usuário' : 'Modo ADM',
        acao: 'alternar-modo-colaborador',
      })
    }
  } else if (nivel === 4) {
    items.push({ Icon: LayoutDashboard, label: 'Dashboard ADM', href: '/dashboard/admin' })
    items.push({ Icon: Building2, label: 'Empresas atribuídas', subpagina: 'auxiliar-adm-empresas' })
  }

  if (items.length === 0) return null

  return { tipo: 'grupo', key: 'admin', label: 'Admin', items }
}

/** Pasta Admin para colaboradores ADM (níveis 2–4) no menu turista/prof/empresa. */
function injetarSecaoAdministracao(secoes, adminLevelN, opts = {}) {
  const nivel = Number(adminLevelN ?? 0)
  if (nivel < 2) return secoes
  const sec = secaoAdminColaborador(adminLevelN, opts)
  if (!sec) return secoes
  const idx = secoes.findIndex((s) => s.tipo === 'sair')
  if (idx < 0) return [...secoes, sec]
  return [...secoes.slice(0, idx), sec, ...secoes.slice(idx)]
}

/**
 * @param {MenuContext} ctx
 * @param {{ omitirModoNaLista: boolean }} opt
 */
function secoesAdmin(ctx, { omitirModoNaLista }) {
  const gAdmin = filtrarMenu(
    [
      { Icon: LayoutDashboard, label: 'Dashboard ADM', href: '/dashboard/admin' },
      {
        Icon: Users,
        label: 'Modo Apresentação',
        subpagina: 'modo-apresentacao',
        condicional: (c) => c.adminLevel === 1 && !omitirModoNaLista,
      },
    ],
    ctx
  )
  const gUsuario = filtrarMenu([{ Icon: User, label: 'Editar Perfil', subpagina: 'editar-perfil' }], ctx)
  const gAplic = filtrarMenu(
    [
      { Icon: History, label: 'Histórico de Compras', subitens: histComprasSubitensGeral() },
      { Icon: Scale, label: 'Denúncias e Decisões', subpagina: 'historico-decisoes' },
      itemConfig,
    ],
    ctx
  )
  return [
    { tipo: 'grupo', key: 'admin', label: 'Admin', items: gAdmin },
    secaoUsuario(gUsuario),
    secaoMinhaConta(ctx),
    { tipo: 'grupo', key: 'aplicativo', label: 'Aplicativo', items: gAplic },
    { tipo: 'sair' },
  ]
}

/**
 * @param {{
 *   aberto: boolean
 *   onFechar: () => void
 *   variant: 'turista' | 'profissional' | 'empresa' | 'admin' | null
 *   nome: string
 *   username: string
 *   fotoUrl: string | null
 *   usuarioId: string | null
 *   placaVermelha?: boolean
 *   adminLevel?: number
 *   empresa?: Record<string, unknown> | null
 *   empresaId?: string | null
 *   onPerfilAtualizado?: () => void
 *   bioText?: string
 *   recursosProfissionaisLiberados?: boolean
 * }} props
 */
export default function MenuLateral({
  aberto,
  onFechar,
  variant,
  nome,
  username,
  fotoUrl,
  usuarioId,
  placaVermelha = false,
  adminLevel = 0,
  empresa = null,
  empresaId = null,
  onPerfilAtualizado,
  bioText = '',
  recursosProfissionaisLiberados = true,
}) {
  const { loading: gateLoading, turistaGate } = useProfissionalGate()
  const {
    ehAnfitriao,
    modo: modoAnfitriao,
    setModo: setModoAnfitriao,
    empresaHospedagemId,
    empresaHospedagemLiberada,
    empresaHospedagem,
    recarregar: recarregarAnfitriao,
  } = useAnfitriaoModo()
  const [empresaAnfitriao, setEmpresaAnfitriao] = useState(null)
  const router = useRouter()
  /** @type {[HistoricoEntry[], (h: HistoricoEntry[]) => void]} */
  const [historico, setHistorico] = useState(/** @type {HistoricoEntry[]} */ ([]))
  const [modalLogout, setModalLogout] = useState(false)
  const [comissoesFerramentasAbertas, setComissoesFerramentasAbertas] = useState(false)
  const [historicoNaoLido, setHistoricoNaoLido] = useState(0)
  const [chatAdmNaoLido, setChatAdmNaoLido] = useState(0)
  const [drawerEntered, setDrawerEntered] = useState(false)
  const fechandoViaHistoryRef = useRef(false)
  const onFecharRef = useRef(onFechar)
  onFecharRef.current = onFechar
  const { historico: historicoDecisoes, fetchHistoricoUsuario } = useInfracoes()
  const { modoAtivo, perfilSimulado } = useModoApresentacao()
  const modoApresentacaoAtivo = modoAtivo
  const {
    emModoAdm: emModoAdmColaborador,
    alternar: alternarModoColaborador,
    habilitado: modoColaboradorDual,
  } = useAdminColaboradorModo()

  const [profVerificadoMenu, setProfVerificadoMenu] = useState(false)
  const [visitasPendentes, setVisitasPendentes] = useState(0)
  const [comprasPendentes, setComprasPendentes] = useState(0)
  const [adminLevelMenu, setAdminLevelMenu] = useState(adminLevel)

  /** Identidade social sempre a do utilizador logado (ADM); preview empresa é só noutras rotas. */
  const usuarioIdEfetivo = usuarioId
  const empresaIdEfetivo = empresaId

  useEffect(() => {
    setAdminLevelMenu(adminLevel)
  }, [adminLevel])

  useEffect(() => {
    if (!usuarioIdEfetivo) return
    let ativo = true
    void (async () => {
      const { data } = await buscarUsuarioCached(supabase, usuarioIdEfetivo, 'admin_level, role')
      if (!ativo) return
      const nivel = Number(data?.admin_level ?? adminLevel)
      setAdminLevelMenu(Number.isFinite(nivel) ? nivel : adminLevel)
    })()
    return () => {
      ativo = false
    }
  }, [usuarioIdEfetivo, adminLevel, aberto])

  useEffect(() => {
    const onConvite = () => {
      if (!usuarioIdEfetivo) return
      invalidarCacheUsuarioSession(usuarioIdEfetivo)
      void buscarUsuarioCached(supabase, usuarioIdEfetivo, 'admin_level').then(({ data }) => {
        const nivel = Number(data?.admin_level ?? 0)
        if (Number.isFinite(nivel)) setAdminLevelMenu(nivel)
      })
    }
    window.addEventListener('admin-convite-respondido', onConvite)
    return () => window.removeEventListener('admin-convite-respondido', onConvite)
  }, [usuarioIdEfetivo])

  useEffect(() => {
    if (!aberto || variant !== 'profissional' || !usuarioId) {
      setProfVerificadoMenu(false)
      return
    }
    let ativo = true
    void (async () => {
      const { data } = await supabase
        .from('profissionais')
        .select('docs_verificado, status')
        .eq('usuario_id', usuarioId)
        .maybeSingle()
      if (!ativo) return
      setProfVerificadoMenu(contaVerificadaDocumentacao('profissional', data))
    })()
    return () => {
      ativo = false
    }
  }, [aberto, variant, usuarioId])

  const [gruposAbertos, setGruposAbertos] = useState(() => ({
    emergencia: false,
    usuario: false,
    'minha-conta': false,
    aplicativo: false,
    profissional: false,
    anfitriao: false,
    empresa: false,
    admin: false,
    'aplic-pessoal': false,
    'aplic-prof-hist': false,
  }))

  const simulandoComoPerfil = Boolean(
    variant === 'admin' && adminLevel === 1 && modoAtivo && perfilSimulado && (perfilSimulado.tipo === 'turista' || perfilSimulado.tipo === 'profissional' || perfilSimulado.tipo === 'empresa')
  )

  const mostrarFichaModoFixa = Boolean(variant === 'admin' && adminLevel === 1 && modoAtivo)
  const omitirModoNaListaAdmin = mostrarFichaModoFixa

  const menuVariantEfetivo = (() => {
    if (simulandoComoPerfil && perfilSimulado) {
      if (perfilSimulado.tipo === 'empresa') return /** @type {const} */ ('empresa')
      if (perfilSimulado.tipo === 'profissional') return /** @type {const} */ ('profissional')
      return /** @type {const} */ ('turista')
    }
    if (ehAnfitriao && modoAnfitriao === 'hospedagem' && empresaHospedagemId && empresaHospedagemLiberada) {
      return /** @type {const} */ ('empresa')
    }
    return variant || 'turista'
  })()

  const recursosProfLiberadosEfetivo =
    variant === 'profissional' && !gateLoading && recursosProfissionaisLiberados
  const profDocsBloqueado = variant === 'profissional' && !recursosProfLiberadosEfetivo

  const empresaIdCtx =
    empresaId ??
    (empresa?.id != null ? String(empresa.id) : null) ??
    (ehAnfitriao && empresaHospedagemId ? String(empresaHospedagemId) : null)

  useEffect(() => {
    if (!ehAnfitriao || !empresaHospedagemId) {
      setEmpresaAnfitriao(null)
      return
    }
    let ativo = true
    void (async () => {
      const { data } = await supabase.from('empresas').select('*').eq('id', empresaHospedagemId).maybeSingle()
      if (!ativo) return
      setEmpresaAnfitriao(data && typeof data === 'object' ? data : null)
    })()
    return () => {
      ativo = false
    }
  }, [ehAnfitriao, empresaHospedagemId, aberto])

  const empresaEfetiva =
    menuVariantEfetivo === 'empresa' && ehAnfitriao && empresaAnfitriao ? empresaAnfitriao : empresa

  const contaVerificadaHeader =
    menuVariantEfetivo === 'empresa' && empresaEfetiva
      ? contaVerificadaDocumentacao('empresa', empresaEfetiva)
      : variant === 'empresa' && empresa
        ? contaVerificadaDocumentacao('empresa', empresa)
        : variant === 'profissional'
          ? profVerificadoMenu
          : false

  const empresaPlano =
    empresaEfetiva?.plano != null ? String(empresaEfetiva.plano) : empresa?.plano != null ? String(empresa.plano) : 'gratuito'
  const empresaCategoria =
    empresaEfetiva?.categoria != null
      ? String(empresaEfetiva.categoria)
      : empresa?.categoria != null
        ? String(empresa.categoria)
        : ''
  const empresaCidade =
    empresaEfetiva?.cidade != null ? String(empresaEfetiva.cidade) : empresa?.cidade != null ? String(empresa.cidade) : ''
  const { servicos: empresaServicos, loading: empresaServicosLoading } = useEmpresaServicosPlano(
    menuVariantEfetivo === 'empresa' ? empresaPlano : null,
    menuVariantEfetivo === 'empresa' ? empresaIdCtx : null,
    {
      aguardarEmpresa: menuVariantEfetivo === 'empresa' && !empresaIdCtx,
      somenteAnfitriao: Boolean(empresaEfetiva?.somente_anfitriao),
    },
  )

  const atualizarIndicadoresMenu = useCallback(async () => {
    if (!usuarioIdEfetivo) return
    const [pendentes, compras] = await Promise.all([
      contarVisitasPerfilPendentes(supabase, usuarioIdEfetivo),
      contarComprasTuristaPendentes(supabase, usuarioIdEfetivo),
    ])
    setVisitasPendentes(pendentes)
    setComprasPendentes(compras)
  }, [usuarioIdEfetivo])

  useEffect(() => {
    if (!aberto || !usuarioIdEfetivo) return
    void atualizarIndicadoresMenu()
  }, [aberto, usuarioIdEfetivo, atualizarIndicadoresMenu])

  useEffect(() => {
    const onRefresh = () => {
      void atualizarIndicadoresMenu()
    }
    window.addEventListener('perfil-atualizado', onRefresh)
    window.addEventListener('profissional-gate-refresh', onRefresh)
    window.addEventListener('perfil-visitas-lidas', onRefresh)
    window.addEventListener('turista-compras-lidas', onRefresh)
    window.addEventListener('turista-compras-atualizado', onRefresh)
    return () => {
      window.removeEventListener('perfil-atualizado', onRefresh)
      window.removeEventListener('profissional-gate-refresh', onRefresh)
      window.removeEventListener('perfil-visitas-lidas', onRefresh)
      window.removeEventListener('turista-compras-lidas', onRefresh)
      window.removeEventListener('turista-compras-atualizado', onRefresh)
    }
  }, [atualizarIndicadoresMenu])

  useEffect(() => {
    if (!usuarioIdEfetivo || menuVariantEfetivo !== 'turista') return
    const ch = supabase
      .channel(`menu-turista-compras-${usuarioIdEfetivo}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'turista_compras',
          filter: `turista_usuario_id=eq.${usuarioIdEfetivo}`,
        },
        () => {
          void atualizarIndicadoresMenu()
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(ch)
    }
  }, [usuarioIdEfetivo, menuVariantEfetivo, atualizarIndicadoresMenu])

  const ctx = {
    variant: menuVariantEfetivo,
    placaVermelha,
    adminLevel,
    recursosProfissionaisLiberados: recursosProfLiberadosEfetivo,
    empresaCategoria,
    empresaCidade,
    empresaServicos,
    somenteAnfitriao: Boolean(empresaEfetiva?.somente_anfitriao),
    anfitriaoModoHospedagem: Boolean(
      ehAnfitriao && modoAnfitriao === 'hospedagem' && empresaHospedagemId && empresaHospedagemLiberada,
    ),
  }

  const secoes = useMemo(() => {
    if (!variant) return []
    const c = {
      variant: menuVariantEfetivo,
      placaVermelha,
      adminLevel,
      recursosProfissionaisLiberados: recursosProfLiberadosEfetivo,
      empresaCategoria,
      empresaCidade,
      empresaServicos,
      ehAnfitriao,
      empresaHospedagemId,
      somenteAnfitriao: Boolean(empresaEfetiva?.somente_anfitriao),
      anfitriaoModoHospedagem: Boolean(
        ehAnfitriao && modoAnfitriao === 'hospedagem' && empresaHospedagemId && empresaHospedagemLiberada,
      ),
    }
    const colabAdminOpts = { emModoAdm: emModoAdmColaborador, temModoDual: modoColaboradorDual }
    const mostrarPreLiberacaoTurista = !Boolean(turistaGate?.documentacao_validada_adm)
    const t = secoesTurista({ mostrarPreLiberacao: mostrarPreLiberacaoTurista })
    const p = secoesProfissional(c)
    const e = secoesEmpresa(c)
    const a = secoesAdmin(c, { omitirModoNaLista: omitirModoNaListaAdmin })
    if (simulandoComoPerfil && perfilSimulado) {
      if (perfilSimulado.tipo === 'empresa') return injetarSecaoAdministracao(e, adminLevelMenu, colabAdminOpts)
      if (perfilSimulado.tipo === 'profissional') {
        if (!recursosProfLiberadosEfetivo) return secoesProfissionalAguardandoDocs(c)
        return injetarSecaoAdministracao(p, adminLevelMenu, colabAdminOpts)
      }
      if (perfilSimulado.tipo === 'turista') return injetarSecaoAdministracao(t, adminLevelMenu, colabAdminOpts)
    }
    if (variant === 'turista') return injetarSecaoAdministracao(t, adminLevelMenu, colabAdminOpts)
    if (variant === 'profissional') {
      if (!recursosProfLiberadosEfetivo) return secoesProfissionalAguardandoDocs(c)
      if (ehAnfitriao && modoAnfitriao === 'hospedagem' && empresaHospedagemId && empresaHospedagemLiberada) {
        return injetarSecaoAdministracao(secoesAnfitriaoComEmpresa(c), adminLevelMenu, colabAdminOpts)
      }
      return injetarSecaoAdministracao(p, adminLevelMenu, colabAdminOpts)
    }
    if (variant === 'empresa') {
      if (ehAnfitriao) return injetarSecaoAdministracao(secoesAnfitriaoComEmpresa(c), adminLevelMenu, colabAdminOpts)
      return injetarSecaoAdministracao(e, adminLevelMenu, colabAdminOpts)
    }
    if (variant === 'admin') return a
    return []
  }, [
    variant,
    menuVariantEfetivo,
    placaVermelha,
    adminLevel,
    recursosProfLiberadosEfetivo,
    simulandoComoPerfil,
    perfilSimulado,
    omitirModoNaListaAdmin,
    empresaCategoria,
    empresaCidade,
    empresaServicos,
    ehAnfitriao,
    empresaHospedagemId,
    empresaHospedagemLiberada,
    empresaEfetiva,
    modoAnfitriao,
    turistaGate,
    adminLevelMenu,
    emModoAdmColaborador,
    modoColaboradorDual,
  ])

  useEffect(() => {
    if (!aberto) {
      setDrawerEntered(false)
      setHistorico([])
      setModalLogout(false)
      return
    }
    setDrawerEntered(false)
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setDrawerEntered(true))
    })
    return () => cancelAnimationFrame(id)
  }, [aberto])

  /** Empilha entry no History para o gesto back/swipe fechar só o menu (não sair da página). */
  useEffect(() => {
    if (!aberto || typeof window === 'undefined') return

    if (!historyTemMenuLateralAberto()) {
      const prev =
        history.state && typeof history.state === 'object' ? { ...history.state } : {}
      history.pushState({ ...prev, [MENU_LATERAL_HISTORY_FLAG]: true }, '')
    }

    const onPopState = () => {
      fechandoViaHistoryRef.current = false
      onFecharRef.current()
    }
    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener('popstate', onPopState)
    }
  }, [aberto])

  const solicitarFechar = useCallback(() => {
    if (typeof window !== 'undefined' && historyTemMenuLateralAberto()) {
      fechandoViaHistoryRef.current = true
      history.back()
      return
    }
    onFecharRef.current()
  }, [])

  useEffect(() => {
    if (!aberto) return
    if (!usuarioIdEfetivo) return
    void fetchHistoricoUsuario(usuarioIdEfetivo)
    prefetchMinhasAtividades(supabase, usuarioIdEfetivo)
    if (variant === 'profissional' || menuVariantEfetivo === 'profissional') {
      prefetchComissoesOfertas(supabase, usuarioIdEfetivo)
    }
  }, [aberto, fetchHistoricoUsuario, usuarioIdEfetivo, variant, menuVariantEfetivo])

  useEffect(() => {
    if (!aberto) return
    setGruposAbertos({
      emergencia: false,
      usuario: false,
      'minha-conta': false,
      aplicativo: false,
      profissional: false,
      empresa: false,
      admin: false,
      'aplic-pessoal': false,
      'aplic-prof-hist': false,
    })
  }, [aberto, menuVariantEfetivo, variant])

  useEffect(() => {
    if (!aberto) return
    const prevBody = document.body.style.overflow
    const prevHtml = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevBody
      document.documentElement.style.overflow = prevHtml
    }
  }, [aberto])

  useEffect(() => {
    setHistoricoNaoLido((historicoDecisoes ?? []).filter((h) => !h.visualizado).length)
  }, [historicoDecisoes])

  const refreshChatAdmBadge = useCallback(async () => {
    if (!usuarioIdEfetivo || variant === 'admin') {
      setChatAdmNaoLido(0)
      return
    }
    try {
      const n = await contarNaoLidasChatAdmMembro(supabase, usuarioIdEfetivo)
      setChatAdmNaoLido(n)
    } catch {
      setChatAdmNaoLido(0)
    }
  }, [usuarioIdEfetivo, variant])

  useEffect(() => {
    if (!usuarioIdEfetivo || variant === 'admin') {
      setChatAdmNaoLido(0)
      return
    }
    let cancelled = false
    /** @type {ReturnType<typeof setTimeout> | null} */
    let debounceId = null

    const scheduleRefresh = () => {
      if (debounceId) clearTimeout(debounceId)
      debounceId = setTimeout(() => {
        debounceId = null
        void refreshChatAdmBadge()
      }, 400)
    }

    void refreshChatAdmBadge()
    const onBadge = () => {
      scheduleRefresh()
    }
    window.addEventListener(GUIA_CHAT_ADM_BADGE_EVENT, onBadge)

    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshChatAdmBadge()
    }
    document.addEventListener('visibilitychange', onVisible)

    const ch = supabase
      .channel(`menu-chat-adm-${usuarioIdEfetivo}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ecossistema_conversa_leitura',
          filter: `usuario_id=eq.${usuarioIdEfetivo}`,
        },
        () => {
          scheduleRefresh()
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ecossistema_conversa_leitura',
          filter: `usuario_id=eq.${usuarioIdEfetivo}`,
        },
        () => {
          scheduleRefresh()
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && !cancelled) void refreshChatAdmBadge()
      })
    return () => {
      cancelled = true
      if (debounceId) clearTimeout(debounceId)
      window.removeEventListener(GUIA_CHAT_ADM_BADGE_EVENT, onBadge)
      document.removeEventListener('visibilitychange', onVisible)
      void supabase.removeChannel(ch)
    }
  }, [usuarioIdEfetivo, variant, refreshChatAdmBadge])

  useEffect(() => {
    if (aberto) void refreshChatAdmBadge()
  }, [aberto, refreshChatAdmBadge])

  const voltarUmNivel = useCallback(() => {
    setHistorico((h) => h.slice(0, -1))
  }, [])

  const topo = historico.length ? historico[historico.length - 1] : null

  useEffect(() => {
    if (topo?.id !== 'comissoes') setComissoesFerramentasAbertas(false)
  }, [topo?.id])

  const abrirSubmenu = (titulo, itens) => {
    setHistorico((h) => [...h, { tipo: 'menu', titulo, itens }])
  }

  const abrirPagina = (titulo, id, historicoTipo) => {
    setHistorico((h) => [...h, { tipo: 'pagina', titulo, id, historicoTipo }])
  }

  const executarItem = (item) => {
    if (item.acao === 'logout') {
      setModalLogout(true)
      return
    }
    if (item.acao === 'alternar-modo-colaborador') {
      limparFlagHistoryMenuLateral()
      alternarModoColaborador()
      onFechar()
      return
    }
    if (item.subpagina === 'anfitriao-modo-social') {
      limparFlagHistoryMenuLateral()
      setModoAnfitriao('anfitriao')
      window.dispatchEvent(new Event('anfitriao-modo-change'))
      if (usuarioIdEfetivo) router.push(`/perfil/${usuarioIdEfetivo}`)
      onFechar()
      return
    }
    if (item.subpagina === 'anfitriao-modo-hospedagem') {
      if (!empresaHospedagemId) {
        abrirPagina('Cadastrar Hospedagem', 'cadastrar-hospedagem-anfitriao')
        return
      }
      const empHospedagem = empresaAnfitriao ?? empresaHospedagem
      if (!empresaDocumentosEnviados(empHospedagem)) {
        abrirPagina('Anexar documentos', 'anexar-documentos-empresa')
        return
      }
      if (!empresaHospedagemLiberada) {
        abrirPagina('Hospedagem em análise', 'hospedagem-pendente')
        return
      }
      setModoAnfitriao('hospedagem')
      void recarregarAnfitriao()
      window.dispatchEvent(new Event('anfitriao-modo-change'))
      window.dispatchEvent(new Event('empresa-gate-refresh'))
      limparFlagHistoryMenuLateral()
      if (empresaHospedagemId) {
        router.push(`/empresa/${empresaHospedagemId}`)
      }
      onFechar()
      return
    }
    if (item.href) {
      marcarReabrirMenuLateral()
      limparFlagHistoryMenuLateral()
      router.push(item.href)
      onFechar()
      return
    }
    if (item.subitens?.length) {
      const filtrados = item.subitens.filter((s) => (s.condicional ? s.condicional(ctx) : true))
      abrirSubmenu(item.label, filtrados)
      return
    }
    if (item.subpagina) {
      if (subpaginaProfissionalBloqueadaPorDocs(item.subpagina, recursosProfLiberadosEfetivo, menuVariantEfetivo)) {
        abrirPagina('Serviço indisponível', 'docs-prof-bloqueado')
        return
      }
      const titulos = {
        'emergencia-item-esquecido': 'Item esquecido',
        'emergencia-socorro': 'SOCORRO',
        'emergencia-adm': 'Chat ADM',
        'emergencia-pre-liberacao': 'Pré-liberação de Cadastro',
        'editar-perfil': 'Editar Perfil',
        'minhas-atividades': 'Minhas Atividades',
        configuracoes: 'Configurações',
        'regras-ecossistema': 'Regras do ecossistema',
        comissoes: 'Comissões',
        agendamento: 'Agendamento',
        tabela: 'Serviços Tabelados',
        manifestos: 'Manifesto',
        'historico-manifestos': 'Manifestos Concluídos',
        'parcerias-prof': 'Parcerias Fechadas',
        'editar-pagina': 'Editar Página',
        'calendario-reservas-hospedagem': 'Calendário de Reservas',
        contratacoes: 'Contratações',
        compras: 'Compras',
        parcerias: 'Parcerias',
        recomendacoes: 'Recomendações',
        'historico-compras': 'Histórico de Compras',
        'historico-decisoes': 'Denúncias e Decisões',
        'historico-stories': 'Histórico de Stories',
        salvos: 'Publicações Salvas',
        'modo-apresentacao': 'Modo Apresentação',
        'auxiliar-adm-empresas': 'Empresas atribuídas',
        'anexar-documentos': 'Anexar Documentos',
        'anexar-documentos-turista': 'Anexar Documentos',
        'anexar-documentos-empresa': 'Anexar documentos',
        'visitantes-perfil': 'Visitantes do Perfil',
      }
      const titulosProfissional = ['historico-compras', 'recomendacoes', 'historico-manifestos']
      const t =
        menuVariantEfetivo === 'profissional' && titulosProfissional.includes(item.subpagina)
          ? item.label
          : titulos[item.subpagina] || item.label
      if (item.subpagina === 'historico-decisoes') {
        const unreadIds = (historicoDecisoes ?? []).filter((h) => !h.visualizado).map((h) => h.id)
        if (unreadIds.length > 0) {
          void Promise.all(
            unreadIds.map((id) => supabase.from('historico_decisoes').update({ visualizado: true }).eq('id', id))
          ).then(() => {
            setHistoricoNaoLido(0)
            void fetchHistoricoUsuario(usuarioIdEfetivo || undefined)
          })
        }
      }
      if (['contratacoes', 'compras', 'recomendacoes'].includes(item.subpagina)) {
        if (menuVariantEfetivo === 'profissional' && item.subpagina === 'recomendacoes') {
          abrirPagina(t, 'recomendacoes-feitas')
        } else {
          abrirPagina(t, 'meu-historico', item.subpagina)
        }
      } else {
        abrirPagina(t, item.subpagina)
      }
    }
  }

  const confirmarLogout = async () => {
    try {
      await signOutCurrentDevice()
      try {
        localStorage.clear()
        sessionStorage.clear()
      } catch {
        /* ignore */
      }
      window.location.href = '/'
    } catch (e) {
      console.error(e)
    } finally {
      setModalLogout(false)
      onFechar()
    }
  }

  const roleEditarPerfil = (() => {
    if (simulandoComoPerfil && perfilSimulado) {
      if (perfilSimulado.tipo === 'profissional') return 'profissional'
      if (perfilSimulado.tipo === 'empresa') return 'empresa'
      return 'turista'
    }
    if (variant === 'admin' && !simulandoComoPerfil) return 'admin'
    if (menuVariantEfetivo === 'profissional') return 'profissional'
    if (menuVariantEfetivo === 'empresa') return 'empresa'
    return 'turista'
  })()

  const renderPagina = () => {
    if (!topo || topo.tipo !== 'pagina') return null
    const id = topo.id
    if (!usuarioIdEfetivo && id !== 'modo-apresentacao') return null
    const histTipo = topo.historicoTipo || 'contratacoes'

    if (id === 'emergencia-item-esquecido') return <EmergenciaItemEsquecido />
    if (id === 'emergencia-socorro') return <EmergenciaSocorro />
    if (id === 'emergencia-adm')
      return (
        <EmergenciaMensageiroAdm
          titulo="Chat ADM"
          subtitulo="Troque informações com um administrador pelo canal oficial."
          placeholder="Escreva sua mensagem…"
        />
      )
    if (id === 'emergencia-pre-liberacao') return <EmergenciaPreLiberacao />
    if (id === 'editar-perfil')
      return (
        <EditarPerfil
          usuarioId={usuarioIdEfetivo}
          role={roleEditarPerfil}
          nomeInicial={nome}
          usernameInicial={username}
          bioInicial={bioText}
          fotoInicial={fotoUrl}
          onSalvo={onPerfilAtualizado}
        />
      )
    if (id === 'minhas-atividades')
      return (
        <MinhasAtividades
          usuarioId={usuarioIdEfetivo}
          onAbrirPublicacao={(postId, comentarioId = null) => {
            setHistorico((h) => [
              ...h,
              { tipo: 'pagina', titulo: 'Publicação', id: 'post-isolado', postId, comentarioId: comentarioId ?? null },
            ])
          }}
        />
      )
    if (id === 'post-isolado' && topo && 'postId' in topo && topo.postId)
      return <PostIsoladoDrawer postId={String(topo.postId)} comentarioId={topo.comentarioId ?? null} />
    if (id === 'salvos')
      return (
        <SalvosDrawer
          usuarioId={usuarioIdEfetivo}
          onAbrirPublicacao={(postId, comentarioId = null) => {
            setHistorico((h) => [
              ...h,
              { tipo: 'pagina', titulo: 'Publicação', id: 'post-isolado', postId, comentarioId: comentarioId ?? null },
            ])
          }}
        />
      )
    if (id === 'configuracoes')
      return (
        <Configuracoes
          variant={menuVariantEfetivo}
          onAbrirRegras={() => abrirPagina('Regras do ecossistema', 'regras-ecossistema')}
        />
      )
    if (id === 'regras-ecossistema') return <RegrasEcossistema />
    if (id === 'historico-compras') return <HistoricoCompras usuarioId={usuarioIdEfetivo} />
    if (id === 'docs-prof-bloqueado') return <AvisoDocsProfissionalBloqueado />
    if (id === 'comissoes')
      return (
        <Comissoes
          usuarioId={usuarioIdEfetivo}
          ferramentasAbertas={comissoesFerramentasAbertas}
        />
      )
    if (id === 'agendamento') return <AgendamentoAutomatico />
    if (id === 'tabela') return <TabelaValores usuarioId={usuarioIdEfetivo} placaVermelha={placaVermelha} />
    if (id === 'manifestos') return <MeusManifestos />
    if (id === 'historico-manifestos') return <HistoricoManifestos />
    if (id === 'parcerias-prof') return <ParceriasProfissional />
    if (id === 'recomendacoes-feitas') return <RecomendacoesFeitas usuarioId={usuarioIdEfetivo} />
    if (id === 'meu-historico') return <MeuHistorico tipo={histTipo} />
    if (id === 'historico-decisoes') {
      const denunciadoTipo =
        menuVariantEfetivo === 'empresa' ? 'empresa' : menuVariantEfetivo === 'profissional' ? 'profissional' : 'turista'
      return (
        <HistoricoDecisoes
          usuarioId={usuarioIdEfetivo}
          empresaId={empresaIdCtx ? String(empresaIdCtx) : empresaIdEfetivo ? String(empresaIdEfetivo) : null}
          denunciadoTipo={denunciadoTipo}
        />
      )
    }
    if (id === 'historico-stories') return <HistoricoStories usuarioId={usuarioIdEfetivo} />
    if (id === 'modo-apresentacao') return <ModoApresentacao />
    if (id === 'auxiliar-adm-empresas') return <AuxiliarAdmEmpresas />
    if (id === 'cadastrar-hospedagem-anfitriao')
      return (
        <CadastrarHospedagemAnfitriao
          onConcluido={async () => {
            await recarregarAnfitriao()
            onPerfilAtualizado?.()
            abrirPagina('Anexar documentos', 'anexar-documentos-empresa')
          }}
        />
      )
    if (id === 'hospedagem-pendente')
      return (
        <p className="px-1 text-sm text-gray-600">
          Seu cadastro de hospedagem e a documentação foram enviados e estão em análise. Após a aprovação do
          administrador, o modo Hospedagem será liberado com o menu completo da empresa.
        </p>
      )
    if (id === 'editar-pagina' && empresaEfetiva && empresaIdCtx) {
      return (
        <EditarPaginaEmpresa
          empresa={empresaEfetiva}
          empresaId={String(empresaIdCtx)}
          onSalvo={onPerfilAtualizado}
        />
      )
    }
    if (id === 'calendario-reservas-hospedagem' && empresaIdCtx) {
      return <CalendarioReservasHospedagem empresaId={String(empresaIdCtx)} />
    }
    if (id === 'visitantes-perfil') return <VisitantesPerfil usuarioId={usuarioIdEfetivo} />
    if (id === 'anexar-documentos-turista')
      return <AnexarDocumentosTurista usuarioId={usuarioIdEfetivo} onConcluido={onPerfilAtualizado} />
    if (id === 'anexar-documentos')
      return <AnexarDocumentos usuarioId={usuarioIdEfetivo} onConcluido={onPerfilAtualizado} />
    if (id === 'anexar-documentos-empresa' && empresaIdCtx && usuarioIdEfetivo)
      return (
        <AnexarDocumentosEmpresa
          empresaId={String(empresaIdCtx)}
          usuarioId={usuarioIdEfetivo}
          nomeFantasiaInicial={
            empresaEfetiva?.nome_fantasia != null
              ? String(empresaEfetiva.nome_fantasia)
              : empresa?.nome_fantasia != null
                ? String(empresa.nome_fantasia)
                : ''
          }
          onConcluido={onPerfilAtualizado}
        />
      )
    return <p className="text-sm text-gray-500">Página indisponível.</p>
  }

  const modItem = { Icon: Users, label: 'Modo Apresentação', subpagina: 'modo-apresentacao' }

  /** @param {MenuItem} item */
  const badgeCountItem = (item) =>
    item.badge ??
    (item.subpagina === 'historico-decisoes'
      ? historicoNaoLido
      : item.subpagina === 'visitantes-perfil'
        ? visitasPendentes
        : item.subpagina === 'historico-compras'
          ? comprasPendentes
          : itemEhChatAdm(item)
          ? chatAdmNaoLido
          : 0)

  /** @param {MenuItem[]} lista @param {{ compact?: boolean }} [opts] */
  const renderListaItens = (lista, opts = {}) => {
    const { compact = false } = opts
    return (
    <ul className={compact ? 'space-y-0.5' : 'space-y-1'}>
      {lista.map((item, idx) => {
        const Ico = item.Icon
        const badgeItem = badgeCountItem(item)
        return (
          <li key={`${item.label}-${idx}`}>
            <button
              type="button"
              onClick={() => executarItem(item)}
              className={`flex w-full items-center gap-3 rounded-xl text-left text-sm font-medium text-gray-900 transition hover:bg-gray-100 ${
                compact ? 'px-0 py-1.5' : 'px-3 py-2.5'
              }`}
            >
              <span
                className={`flex shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-500 ${
                  compact ? 'h-8 w-8' : 'h-9 w-9'
                }`}
                aria-hidden
              >
                <Ico size={compact ? 16 : 20} strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1">{item.label}</span>
              {item.subpagina === 'modo-apresentacao' && modoApresentacaoAtivo ? (
                <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white">
                  ON
                </span>
              ) : badgeItem > 0 ? (
                <span className="flex min-h-[14px] min-w-[14px] max-w-[2rem] shrink-0 items-center justify-center rounded-full bg-[#F44336] px-0.5 text-[9px] font-bold leading-none text-white tabular-nums">
                  {badgeItem > 99 ? '99+' : badgeItem}
                </span>
              ) : null}
            </button>
          </li>
        )
      })}
    </ul>
    )
  }

  const renderItensSecaoGrupo = (sec, opts = { compact: true }) => {
    const itens = filtrarMenu(sec.items ?? [], ctx)
    if (sec.key === 'empresa' && menuVariantEfetivo === 'empresa') {
      if (empresaServicosLoading) {
        return <p className="py-3 text-center text-xs text-gray-400">Carregando…</p>
      }
      if (itens.length === 0 && (sec.items?.length ?? 0) > 0) {
        return <AvisoPlanoEmpresaBloqueado compact className="py-1" />
      }
    }
    return renderListaItens(itens, opts)
  }

  const toggleGrupo = (g) => {
    setGruposAbertos((p) => ({ ...p, [g]: !p[g] }))
  }

  /**
   * @param {Array<{ key: string, label: string, items: MenuItem[] }>} subgrupos
   */
  const renderSubgrupos = (subgrupos) =>
    subgrupos.map((sg) => {
      const abSub = gruposAbertos[sg.key] ?? false
      const SubIcon = ICONE_SUBGRUPO[sg.key] ?? User
      const subgrupoBloqueado = profDocsBloqueado && SUBGRUPOS_MENU_PROF_BLOQUEADOS_DOCS.has(sg.key)
      const itensSub = filtrarMenu(sg.items, ctx)
      if (!subgrupoBloqueado && itensSub.length === 0) return null
      return (
        <div key={sg.key} className="mb-1 border-b border-gray-50 last:border-0">
          <button
            type="button"
            onClick={() => toggleGrupo(sg.key)}
            className="flex w-full items-center justify-between gap-2 py-2 pl-0 pr-0 text-left"
          >
            <span className="flex min-w-0 flex-1 items-center gap-3">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-500"
                aria-hidden
              >
                <SubIcon size={16} strokeWidth={1.75} />
              </span>
              <span className="text-sm font-bold tracking-wide text-gray-900">{sg.label}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              {abSub ? (
                <ChevronUp className="h-3.5 w-3.5 shrink-0 text-gray-500" aria-hidden />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-500" aria-hidden />
              )}
            </span>
          </button>
          {abSub ? (
            <div className="pb-1">
              {subgrupoBloqueado ? <AvisoDocsProfissionalBloqueado className="py-4" /> : renderListaItens(itensSub, { compact: true })}
            </div>
          ) : null}
        </div>
      )
    })

  if (!aberto || !variant) return null

  const mostrarVoltar = historico.length > 0

  const renderItemLinha = (item, opts = {}) => {
    const { emergencia, semIconBg } = opts
    const Ico = item.Icon
    const isEm = emergencia
    const badgeItem = badgeCountItem(item)
    return (
      <button
        type="button"
        onClick={() => executarItem(item)}
        className={
          isEm
            ? 'mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50'
            : 'mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-gray-900 transition hover:bg-gray-100'
        }
      >
        {!semIconBg ? (
          <span
            className={
              isEm
                ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600'
                : 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-700'
            }
            aria-hidden
          >
            <Ico size={20} strokeWidth={1.75} />
          </span>
        ) : null}
        <span className="min-w-0 flex-1">{item.label}</span>
        {item.subpagina === 'modo-apresentacao' && modoApresentacaoAtivo ? (
          <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white">
            ON
          </span>
        ) : badgeItem > 0 ? (
          <span className="flex min-h-[14px] min-w-[14px] max-w-[2rem] shrink-0 items-center justify-center rounded-full bg-[#F44336] px-0.5 text-[9px] font-bold leading-none text-white tabular-nums">
            {badgeItem > 99 ? '99+' : badgeItem}
          </span>
        ) : null}
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-[100] max-h-[100dvh]">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Fechar menu" onClick={solicitarFechar} />
      <aside
        className={`absolute right-0 top-0 flex h-full max-h-[100dvh] w-full min-w-0 flex-col overflow-hidden bg-white text-gray-900 shadow-xl transition-transform duration-300 ease-out ${
          drawerEntered ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Menu lateral"
      >
        <div className="shrink-0 bg-white pt-safe">
          <div className="flex items-center gap-3 px-3 py-2">
          {topo?.titulo ? (
            <div className="flex min-w-0 flex-1 items-center gap-1">
              {topo.tipo === 'pagina' && textoInfoDrawer(topo.id) ? (
                <BotaoInfoPopup
                  texto={textoInfoDrawer(topo.id)}
                  ariaLabel={`Informações sobre ${topo.titulo}`}
                />
              ) : null}
              {topo.tipo === 'pagina' && topo.id === 'comissoes' ? (
                <button
                  type="button"
                  onClick={() => setComissoesFerramentasAbertas((v) => !v)}
                  className="shrink-0 rounded-full p-1 text-[#0097b2] transition hover:bg-[#0097b2]/10"
                  aria-label={
                    comissoesFerramentasAbertas
                      ? 'Ocultar busca e favoritos'
                      : 'Mostrar busca e favoritos'
                  }
                  aria-expanded={comissoesFerramentasAbertas}
                >
                  <ChevronDown
                    size={22}
                    className={`transition-transform duration-200 ${
                      comissoesFerramentasAbertas ? 'rotate-180' : ''
                    }`}
                    aria-hidden
                  />
                </button>
              ) : null}
              <h2 className="min-w-0 flex-1 truncate text-lg font-bold leading-tight text-[#001f3f]">
                {topo.titulo}
              </h2>
            </div>
          ) : (
            <h2 className="min-w-0 flex-1 truncate text-lg font-bold leading-tight text-[#0097b2]">
              Ecossistema 3F
            </h2>
          )}
          <button
            type="button"
            onClick={mostrarVoltar ? voltarUmNivel : solicitarFechar}
            className={[
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white shadow-sm transition',
              mostrarVoltar
                ? 'bg-[#0097b2] hover:bg-[#007a91] active:brightness-95'
                : 'bg-red-600 hover:bg-red-700 active:bg-red-800',
            ].join(' ')}
            aria-label={mostrarVoltar ? 'Voltar' : 'Fechar'}
          >
            {mostrarVoltar ? (
              <ArrowRight size={16} strokeWidth={2.5} aria-hidden />
            ) : (
              <X size={16} strokeWidth={2.5} aria-hidden />
            )}
          </button>
          </div>
        </div>

        {!topo ? (
          <>
            <div className="shrink-0 border-b border-gray-100 px-4 pt-0 pb-3">
              <div className="flex items-center gap-3">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-gray-200">
                  {fotoUrl ? <AvatarImage src={fotoUrl} alt="" fill className="object-cover" sizes="56px" /> : null}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-gray-900">
                    <NomeComVerificacao
                      nome={nome || 'Usuário'}
                      verificado={contaVerificadaHeader}
                      verificadoTipo={variant === 'empresa' ? 'empresa' : 'profissional'}
                      nomeClassName="truncate"
                    />
                  </p>
                  <p className="truncate text-sm text-gray-500">@{username || 'usuario'}</p>
                </div>
              </div>
            </div>

            {mostrarFichaModoFixa ? (
              <div className="shrink-0 border-b border-amber-100 bg-amber-50/60 px-1 py-1">
                {renderItemLinha(modItem)}
              </div>
            ) : null}

            <nav className="scrollbar-perfil min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-2 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
              {secoes.map((sec, i) => {
                if (sec.tipo === 'grupo') {
                  const ab = gruposAbertos[sec.key] ?? false
                  const grupoBloqueado = profDocsBloqueado && GRUPOS_MENU_PROF_BLOQUEADOS_DOCS.has(sec.key)
                  return (
                    <div key={`g-${sec.key}`} className="border-b border-gray-100">
                      <button
                        type="button"
                        onClick={() => toggleGrupo(sec.key)}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
                      >
                        <span className="flex min-w-0 flex-1 items-center gap-2">
                          <span className="shrink-0 text-base leading-none text-gray-900" aria-hidden>
                            •
                          </span>
                          <span className="text-base font-bold tracking-wide text-gray-900">{sec.label}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          {ab ? (
                            <ChevronUp className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
                          ) : (
                            <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
                          )}
                        </span>
                      </button>
                      {ab ? (
                        <div className="px-3 pb-2">
                          {grupoBloqueado ? (
                            <AvisoDocsProfissionalBloqueado className="py-4" />
                          ) : sec.subgruposDepois ? (
                            <>
                              {renderItensSecaoGrupo(sec, { compact: true })}
                              {sec.subgrupos?.length ? (
                                <div className={(sec.items?.length ?? 0) > 0 ? 'mt-1 border-t border-gray-100 pt-1' : ''}>
                                  {renderSubgrupos(sec.subgrupos)}
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <>
                              {sec.subgrupos?.length ? renderSubgrupos(sec.subgrupos) : null}
                              {sec.subgrupos?.length
                                ? (sec.items?.length ?? 0) > 0 ? (
                                    <div className="mt-1 border-t border-gray-100 pt-1">
                                      {renderItensSecaoGrupo(sec, { compact: true })}
                                    </div>
                                  ) : null
                                : renderItensSecaoGrupo(sec, { compact: true })}
                            </>
                          )}
                        </div>
                      ) : null}
                    </div>
                  )
                }
                if (sec.tipo === 'sair') {
                  return (
                    <div key="out" className="border-t border-gray-200">
                      <button
                        type="button"
                        onClick={() => executarItem(itemSair)}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition hover:bg-gray-100"
                      >
                        <span className="flex min-w-0 flex-1 items-center gap-2">
                          <span className="shrink-0 text-base leading-none text-gray-900" aria-hidden>
                            •
                          </span>
                          <span className="text-base font-bold tracking-wide text-gray-900">{itemSair.label}</span>
                        </span>
                      </button>
                    </div>
                  )
                }
                return null
              })}
            </nav>
          </>
        ) : topo.tipo === 'menu' ? (
          <nav className="scrollbar-perfil min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-3 pt-1 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
            {renderListaItens(topo.itens)}
          </nav>
        ) : (
          <div className="scrollbar-perfil min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-3 pt-1 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
            {renderPagina()}
          </div>
        )}

        {modalLogout ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 p-4 text-gray-900">
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-gray-900 shadow-xl">
              <h3 className="text-lg font-bold text-gray-900">Sair da conta?</h3>
              <p className="mt-2 text-sm text-gray-600">Você precisará entrar novamente para acessar o Guia 3F.</p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-lg border border-gray-200 bg-white py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
                  onClick={() => setModalLogout(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700"
                  onClick={() => void confirmarLogout()}
                >
                  Sim, sair
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  )
}
