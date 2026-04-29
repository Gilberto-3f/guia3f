'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bookmark,
  Building2,
  Calendar,
  Car,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  DollarSign,
  Gem,
  Handshake,
  History,
  LayoutDashboard,
  LogOut,
  Megaphone,
  MessageSquare,
  Paperclip,
  Scale,
  Settings,
  ShieldAlert,
  ShoppingBag,
  ShoppingCart,
  Speaker,
  Star,
  Table,
  User,
  Users,
  X,
} from 'lucide-react'
import { useRouter } from '@/i18n/navigation'
import { clearSessionCookiesOnServer } from '@/lib/authCookieSync'
import { supabase } from '@/lib/supabase'
import { useInfracoes } from '@/app/[locale]/(admin)/dashboard/admin/hooks/useInfracoes'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'

import Emergencia from '@/components/perfil/subpaginas/Emergencia'
import EditarPerfil from '@/components/perfil/subpaginas/EditarPerfil'
import MeuHistorico from '@/components/perfil/subpaginas/MeuHistorico'
import MinhasAtividades from '@/components/perfil/subpaginas/MinhasAtividades'
import PostIsoladoDrawer from '@/components/perfil/subpaginas/PostIsoladoDrawer'
import Configuracoes from '@/components/perfil/subpaginas/Configuracoes'
import Comissoes from '@/components/perfil/subpaginas/Comissoes'
import AgendamentoAutomatico from '@/components/perfil/subpaginas/AgendamentoAutomatico'
import TabelaValores from '@/components/perfil/subpaginas/TabelaValores'
import MeusManifestos from '@/components/perfil/subpaginas/MeusManifestos'
import EditarPaginaEmpresa from '@/components/perfil/subpaginas/EditarPaginaEmpresa'
import CadastrarComissao from '@/components/perfil/subpaginas/CadastrarComissao'
import HistoricoDecisoes from '@/components/perfil/subpaginas/HistoricoDecisoes'
import SalvosDrawer from '@/components/perfil/subpaginas/SalvosDrawer'
import ModoApresentacao from '@/components/perfil/subpaginas/ModoApresentacao'
import AnexarDocumentos from '@/components/perfil/subpaginas/AnexarDocumentos'

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
 * }} MenuContext
 */

const itemConfig = /** @type {const} */ {
  Icon: Settings,
  label: 'Configurações',
  subpagina: 'configuracoes',
}

const itemSair = /** @type {const} */ { Icon: LogOut, label: 'Sair', acao: 'logout' }

/**
 * @param {MenuItem[]} itens
 * @param {MenuContext} ctx
 * @returns {MenuItem[]}
 */
function filtrarMenu(itens, ctx) {
  return itens.filter((item) => (item.condicional ? item.condicional(ctx) : true))
}

const histComprasSubitensTurista = () => [
  { Icon: Car, label: 'Contratações', subpagina: 'contratacoes' },
  { Icon: ShoppingBag, label: 'Compras', subpagina: 'compras' },
]

const histComprasSubitensGeral = () => [
  { Icon: Handshake, label: 'Parcerias', subpagina: 'parcerias' },
  { Icon: Speaker, label: 'Recomendações', subpagina: 'recomendacoes' },
  { Icon: Car, label: 'Contratações', subpagina: 'contratacoes' },
  { Icon: ShoppingBag, label: 'Compras', subpagina: 'compras' },
]

function secoesTurista() {
  const em = { Icon: ShieldAlert, label: 'EMERGÊNCIA', subpagina: 'emergencia' }
  const gUsuario = [
    { Icon: User, label: 'Editar Perfil', subpagina: 'editar-perfil' },
    { Icon: Activity, label: 'Minhas Atividades', subpagina: 'minhas-atividades' },
    { Icon: Bookmark, label: 'Publicações Salvas', subpagina: 'salvos' },
  ]
  const gAplic = [
    { Icon: History, label: 'Histórico de Compras', subitens: histComprasSubitensTurista() },
    { Icon: Scale, label: 'Histórico de Decisões', subpagina: 'historico-decisoes' },
  ]
  return [/** @type {const} */ { tipo: 'emergencia', item: em }, { tipo: 'grupo', key: 'usuario', label: 'USUÁRIO', items: gUsuario }, { tipo: 'grupo', key: 'aplicativo', label: 'APLICATIVO', items: gAplic }, { tipo: 'config' }, { tipo: 'sair' }]
}

/**
 * @param {MenuContext} ctx
 */
function secoesProfissional(ctx) {
  const gUsuario = filtrarMenu(
    [
      { Icon: User, label: 'Editar Perfil', subpagina: 'editar-perfil' },
      { Icon: Paperclip, label: 'Anexar Documentos', subpagina: 'anexar-documentos' },
      { Icon: Activity, label: 'Minhas Atividades', subpagina: 'minhas-atividades' },
      { Icon: Bookmark, label: 'Publicações Salvas', subpagina: 'salvos' },
    ],
    ctx
  )
  const gPro = ctx.recursosProfissionaisLiberados
    ? filtrarMenu(
        [
          { Icon: DollarSign, label: 'Comissões', subpagina: 'comissoes' },
          {
            Icon: Calendar,
            label: 'Agendamento Automático',
            subpagina: 'agendamento',
            condicional: (c) => c.placaVermelha === true,
          },
          {
            Icon: Table,
            label: 'Tabela de Valores',
            subpagina: 'tabela',
            condicional: (c) => c.placaVermelha === true,
          },
          {
            Icon: ClipboardList,
            label: 'Meus Manifestos',
            subpagina: 'manifestos',
            condicional: (c) => c.placaVermelha === true,
          },
          { Icon: Handshake, label: 'Histórico de Parcerias', subpagina: 'parcerias' },
        ],
        ctx
      )
    : []
  const gAplic = filtrarMenu(
    [
      {
        Icon: History,
        label: 'Histórico de Compras',
        subitens: histComprasSubitensGeral(),
      },
      { Icon: Scale, label: 'Histórico de Decisões', subpagina: 'historico-decisoes' },
    ],
    ctx
  )
  const secProf =
    gPro.length > 0 ? [/** @type {const} */ { tipo: 'grupo', key: 'profissional', label: 'PROFISSIONAL', items: gPro }] : []
  return [
    /** @type {const} */ { tipo: 'grupo', key: 'usuario', label: 'USUÁRIO', items: gUsuario },
    ...secProf,
    { tipo: 'grupo', key: 'aplicativo', label: 'APLICATIVO', items: gAplic },
    { tipo: 'config' },
    { tipo: 'sair' },
  ]
}

/**
 * @param {MenuContext} ctx
 */
function secoesEmpresa() {
  const gUsuario = [
    { Icon: Building2, label: 'Editar Página', subpagina: 'editar-pagina' },
    { Icon: Activity, label: 'Minhas Atividades', subpagina: 'minhas-atividades' },
    { Icon: Bookmark, label: 'Publicações Salvas', subpagina: 'salvos' },
  ]
  const gEmp = [
    { Icon: Megaphone, label: 'Publicidade', href: '/empresa/menu/publicidade' },
    { Icon: MessageSquare, label: 'Chat ADM', href: '/empresa/menu/chat-adm' },
    { Icon: ShoppingCart, label: 'Compras Paraguai', href: '/empresa/menu/compras-paraguai' },
    { Icon: Gem, label: 'Planos', href: '/empresa/menu/planos' },
  ]
  const gAplic = [
    { Icon: AlertTriangle, label: 'Avaliações e denúncias', href: '/empresa/menu/denuncias' },
    { Icon: Scale, label: 'Histórico de Decisões', subpagina: 'historico-decisoes' },
  ]
  return [/** @type {const} */ { tipo: 'grupo', key: 'usuario', label: 'USUÁRIO', items: gUsuario }, { tipo: 'grupo', key: 'empresa', label: 'EMPRESA', items: gEmp }, { tipo: 'grupo', key: 'aplicativo', label: 'APLICATIVO', items: gAplic }, { tipo: 'config' }, { tipo: 'sair' }]
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
  const gUsuario = filtrarMenu(
    [
      { Icon: User, label: 'Editar Perfil', subpagina: 'editar-perfil' },
      { Icon: Activity, label: 'Minhas Atividades', subpagina: 'minhas-atividades' },
      { Icon: Bookmark, label: 'Publicações Salvas', subpagina: 'salvos' },
    ],
    ctx
  )
  const gAplic = filtrarMenu(
    [
      { Icon: History, label: 'Histórico de Compras', subitens: histComprasSubitensGeral() },
      { Icon: Scale, label: 'Histórico de Decisões', subpagina: 'historico-decisoes' },
    ],
    ctx
  )
  return [/** @type {const} */ { tipo: 'grupo', key: 'admin', label: 'ADMIN', items: gAdmin }, { tipo: 'grupo', key: 'usuario', label: 'USUÁRIO', items: gUsuario }, { tipo: 'grupo', key: 'aplicativo', label: 'APLICATIVO', items: gAplic }, { tipo: 'config' }, { tipo: 'sair' }]
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
  const router = useRouter()
  /** @type {[HistoricoEntry[], (h: HistoricoEntry[]) => void]} */
  const [historico, setHistorico] = useState(/** @type {HistoricoEntry[]} */ ([]))
  const [modalLogout, setModalLogout] = useState(false)
  const [historicoNaoLido, setHistoricoNaoLido] = useState(0)
  const [drawerEntered, setDrawerEntered] = useState(false)
  const { historico: historicoDecisoes, fetchHistoricoUsuario } = useInfracoes()
  const { modoAtivo, perfilSimulado } = useModoApresentacao()
  const modoApresentacaoAtivo = modoAtivo

  const [gruposAbertos, setGruposAbertos] = useState(() => ({
    usuario: true,
    aplicativo: false,
    profissional: false,
    empresa: false,
    admin: false,
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
    return variant || 'turista'
  })()

  /** Identidade social sempre a do utilizador logado (ADM); preview empresa é só noutras rotas. */
  const usuarioIdEfetivo = usuarioId
  const empresaIdEfetivo = empresaId

  const ctx = { variant: menuVariantEfetivo, placaVermelha, adminLevel, recursosProfissionaisLiberados }

  const secoes = useMemo(() => {
    if (!variant) return []
    const c = { variant: menuVariantEfetivo, placaVermelha, adminLevel, recursosProfissionaisLiberados }
    const t = secoesTurista()
    const p = secoesProfissional(c)
    const e = secoesEmpresa()
    const a = secoesAdmin(c, { omitirModoNaLista: omitirModoNaListaAdmin })
    if (simulandoComoPerfil && perfilSimulado) {
      if (perfilSimulado.tipo === 'empresa') return e
      if (perfilSimulado.tipo === 'profissional') return p
      if (perfilSimulado.tipo === 'turista') return t
    }
    if (variant === 'turista') return t
    if (variant === 'profissional') return p
    if (variant === 'empresa') return e
    if (variant === 'admin') return a
    return []
  }, [
    variant,
    menuVariantEfetivo,
    placaVermelha,
    adminLevel,
    recursosProfissionaisLiberados,
    simulandoComoPerfil,
    perfilSimulado,
    omitirModoNaListaAdmin,
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

  useEffect(() => {
    if (!aberto) return
    if (!usuarioIdEfetivo) return
    void fetchHistoricoUsuario(usuarioIdEfetivo)
  }, [aberto, fetchHistoricoUsuario, usuarioIdEfetivo])

  useEffect(() => {
    if (!aberto) return
    setGruposAbertos({
      usuario: true,
      aplicativo: false,
      profissional: false,
      empresa: false,
      admin: false,
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

  const voltarUmNivel = useCallback(() => {
    setHistorico((h) => h.slice(0, -1))
  }, [])

  const topo = historico.length ? historico[historico.length - 1] : null

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
    if (item.href) {
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
      const titulos = {
        emergencia: 'Emergência',
        'editar-perfil': 'Editar Perfil',
        'minhas-atividades': 'Minhas Atividades',
        configuracoes: 'Configurações',
        comissoes: 'Comissões',
        agendamento: 'Agendamento Automático',
        tabela: 'Tabela de Valores',
        manifestos: 'Meus Manifestos',
        'editar-pagina': 'Editar Página',
        'cadastrar-comissao': 'Cadastrar Comissão',
        contratacoes: 'Contratações',
        compras: 'Compras',
        parcerias: 'Parcerias',
        recomendacoes: 'Recomendações',
        'historico-decisoes': 'Histórico de Decisões',
        salvos: 'Publicações Salvas',
        'modo-apresentacao': 'Modo Apresentação',
        'anexar-documentos': 'Anexar Documentos',
      }
      const t = titulos[item.subpagina] || item.label
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
      if (['contratacoes', 'compras', 'parcerias', 'recomendacoes'].includes(item.subpagina)) {
        abrirPagina(t, 'meu-historico', item.subpagina)
      } else {
        abrirPagina(t, item.subpagina)
      }
    }
  }

  const confirmarLogout = async () => {
    try {
      await supabase.auth.signOut()
      try {
        await clearSessionCookiesOnServer()
      } catch {
        /* ignore */
      }
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

    if (id === 'emergencia') return <Emergencia />
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
    if (id === 'configuracoes') return <Configuracoes />
    if (id === 'comissoes') return <Comissoes />
    if (id === 'agendamento') return <AgendamentoAutomatico />
    if (id === 'tabela') return <TabelaValores />
    if (id === 'manifestos') return <MeusManifestos />
    if (id === 'meu-historico') return <MeuHistorico tipo={histTipo} />
    if (id === 'historico-decisoes') return <HistoricoDecisoes />
    if (id === 'modo-apresentacao') return <ModoApresentacao />
    if (id === 'editar-pagina' && empresa && empresaIdEfetivo) {
      return <EditarPaginaEmpresa empresa={empresa} empresaId={String(empresaIdEfetivo)} onSalvo={onPerfilAtualizado} />
    }
    if (id === 'cadastrar-comissao' && empresaIdEfetivo) return <CadastrarComissao empresaId={empresaIdEfetivo} />
    if (id === 'anexar-documentos')
      return <AnexarDocumentos usuarioId={usuarioIdEfetivo} onConcluido={onPerfilAtualizado} />
    return <p className="text-sm text-gray-500">Página indisponível.</p>
  }

  const modItem = { Icon: Users, label: 'Modo Apresentação', subpagina: 'modo-apresentacao' }

  /** @param {MenuItem[]} lista */
  const renderListaItens = (lista) => (
    <ul className="space-y-1">
      {lista.map((item, idx) => {
        const Ico = item.Icon
        return (
          <li key={`${item.label}-${idx}`}>
            <button
              type="button"
              onClick={() => executarItem(item)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-gray-800 transition hover:bg-gray-100"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-700" aria-hidden>
                <Ico size={20} strokeWidth={1.75} />
              </span>
              <span className="flex-1">{item.label}</span>
              {(item.badge ?? (item.subpagina === 'historico-decisoes' ? historicoNaoLido : 0)) > 0 ||
              (item.subpagina === 'modo-apresentacao' && modoApresentacaoAtivo) ? (
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-bold text-white ${
                    item.subpagina === 'modo-apresentacao' && modoApresentacaoAtivo ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                >
                  {item.subpagina === 'modo-apresentacao' && modoApresentacaoAtivo
                    ? 'ON'
                    : item.badge ?? (item.subpagina === 'historico-decisoes' ? historicoNaoLido : 0)}
                </span>
              ) : null}
            </button>
          </li>
        )
      })}
    </ul>
  )

  const toggleGrupo = (g) => {
    setGruposAbertos((p) => ({ ...p, [g]: !p[g] }))
  }

  if (!aberto || !variant) return null

  const mostrarVoltar = historico.length > 0

  const renderItemLinha = (item, opts = {}) => {
    const { emergencia, semIconBg } = opts
    const Ico = item.Icon
    const isEm = emergencia
    return (
      <button
        type="button"
        onClick={() => executarItem(item)}
        className={
          isEm
            ? 'mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50'
            : 'mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-gray-800 transition hover:bg-gray-100'
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
        <span className="flex-1">{item.label}</span>
        {(item.badge ?? (item.subpagina === 'historico-decisoes' ? historicoNaoLido : 0)) > 0 ||
        (item.subpagina === 'modo-apresentacao' && modoApresentacaoAtivo) ? (
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold text-white ${
              item.subpagina === 'modo-apresentacao' && modoApresentacaoAtivo ? 'bg-amber-500' : 'bg-red-500'
            }`}
          >
            {item.subpagina === 'modo-apresentacao' && modoApresentacaoAtivo
              ? 'ON'
              : item.badge ?? (item.subpagina === 'historico-decisoes' ? historicoNaoLido : 0)}
          </span>
        ) : null}
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-[100] max-h-[100dvh]">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Fechar menu" onClick={onFechar} />
      <aside
        className={`absolute right-0 top-0 flex h-full max-h-[100dvh] w-[min(92vw,28rem)] min-w-0 flex-col overflow-hidden bg-white text-gray-900 shadow-xl transition-transform duration-300 ease-out ${
          drawerEntered ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Menu lateral"
      >
        <div className={`flex shrink-0 justify-end ${mostrarVoltar ? 'p-2 pb-0' : 'px-2 pt-0 pb-0'}`}>
          {mostrarVoltar ? (
            <button
              type="button"
              onClick={voltarUmNivel}
              className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900"
              aria-label="Voltar"
            >
              <ArrowLeft size={20} className="shrink-0" />
              Voltar
            </button>
          ) : (
            <button
              type="button"
              onClick={onFechar}
              className="rounded-full p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Fechar"
            >
              <X size={22} />
            </button>
          )}
        </div>

        {!topo ? (
          <>
            <div className="shrink-0 border-b border-gray-100 px-4 pt-0 pb-2">
              <div className="flex items-center gap-3">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-gray-200">
                  {fotoUrl ? <Image src={fotoUrl} alt="" fill className="object-cover" sizes="56px" /> : null}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-gray-900">{nome || 'Usuário'}</p>
                  <p className="truncate text-sm text-gray-500">@{username || 'usuario'}</p>
                </div>
              </div>
              {variant === 'admin' && adminLevel >= 1 ? (
                <p className="mt-2 text-xs font-semibold text-amber-700">ADMIN</p>
              ) : null}
            </div>

            {mostrarFichaModoFixa ? (
              <div className="shrink-0 border-b border-amber-100 bg-amber-50/60 px-1 py-1">
                {renderItemLinha(modItem)}
              </div>
            ) : null}

            <nav className="scrollbar-perfil min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-2 pt-0 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
              {secoes.map((sec, i) => {
                if (sec.tipo === 'emergencia') {
                  return <div key={`em-${i}`}>{renderItemLinha(sec.item, { emergencia: true })}</div>
                }
                if (sec.tipo === 'grupo') {
                  const ab = gruposAbertos[sec.key] ?? true
                  return (
                    <div key={`g-${sec.key}`} className="border-b border-gray-100">
                      <button
                        type="button"
                        onClick={() => toggleGrupo(sec.key)}
                        className="flex w-full items-center justify-between px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-gray-600"
                      >
                        <span>{sec.label}</span>
                        {ab ? <ChevronUp className="h-4 w-4 shrink-0" aria-hidden /> : <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />}
                      </button>
                      {ab ? (
                        <div className="border-l-2 border-gray-200 pb-2 pl-2 pr-0 ml-2">{renderListaItens(filtrarMenu(sec.items, ctx))}</div>
                      ) : null}
                    </div>
                  )
                }
                if (sec.tipo === 'config') {
                  return (
                    <div key="cfg" className="px-1 pt-1">
                      {renderItemLinha(
                        { Icon: itemConfig.Icon, label: itemConfig.label, subpagina: itemConfig.subpagina },
                        { semIconBg: false }
                      )}
                    </div>
                  )
                }
                if (sec.tipo === 'sair') {
                  return (
                    <div key="out" className="border-t border-gray-200 px-1 py-1">
                      {renderItemLinha(
                        { Icon: itemSair.Icon, label: itemSair.label, acao: itemSair.acao },
                        { semIconBg: false }
                      )}
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
