'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bookmark,
  Building2,
  Calendar,
  Car,
  ClipboardList,
  DollarSign,
  Gem,
  Handshake,
  History,
  LayoutDashboard,
  LogOut,
  Megaphone,
  MessageSquare,
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
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useInfracoes } from '@/app/[locale]/(admin)/dashboard/admin/hooks/useInfracoes'

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
 *   acao?: 'logout' | 'simulacao'
 *   simRole?: 'turista' | 'profissional' | 'empresa'
 *   subitens?: MenuItem[]
 *   condicional?: (ctx: MenuContext) => boolean
 * }} MenuItem
 */

/**
 * @typedef {{
 *   variant: 'turista' | 'profissional' | 'empresa' | 'admin'
 *   placaVermelha: boolean
 *   adminLevel: number
 * }} MenuContext
 */

/**
 * @returns {MenuItem[]}
 */
function itensTurista() {
  return [
    { Icon: ShieldAlert, label: 'EMERGÊNCIA', subpagina: 'emergencia' },
    { Icon: User, label: 'Editar Perfil', subpagina: 'editar-perfil' },
    {
      Icon: History,
      label: 'Meu Histórico',
      subitens: [
        { Icon: Car, label: 'Contratações', subpagina: 'contratacoes' },
        { Icon: ShoppingBag, label: 'Compras', subpagina: 'compras' },
      ],
    },
    { Icon: Activity, label: 'Minhas Atividades', subpagina: 'minhas-atividades' },
    { Icon: Bookmark, label: 'Salvos', subpagina: 'salvos' },
    { Icon: Scale, label: 'Histórico de Decisões', subpagina: 'historico-decisoes' },
    { Icon: Settings, label: 'Configurações', subpagina: 'configuracoes' },
    { Icon: LogOut, label: 'Sair', acao: 'logout' },
  ]
}

/**
 * @param {MenuContext} ctx
 * @returns {MenuItem[]}
 */
function itensProfissional(ctx) {
  const base = /** @type {MenuItem[]} */ ([
    { Icon: DollarSign, label: 'Comissões', subpagina: 'comissoes' },
    {
      Icon: Star,
      label: 'Profissionais do Turismo',
      subitens: [
        { Icon: Calendar, label: 'Agendamento Automático', subpagina: 'agendamento' },
        { Icon: Table, label: 'Tabela de Valores', subpagina: 'tabela' },
        { Icon: ClipboardList, label: 'Meus Manifestos', subpagina: 'manifestos' },
      ],
      condicional: (c) => c.placaVermelha === true,
    },
    { Icon: User, label: 'Editar Perfil', subpagina: 'editar-perfil' },
    {
      Icon: History,
      label: 'Meu Histórico',
      subitens: [
        { Icon: Handshake, label: 'Parcerias', subpagina: 'parcerias' },
        { Icon: Speaker, label: 'Recomendações', subpagina: 'recomendacoes' },
        { Icon: Car, label: 'Contratações', subpagina: 'contratacoes' },
        { Icon: ShoppingBag, label: 'Compras', subpagina: 'compras' },
      ],
    },
    { Icon: Activity, label: 'Minhas Atividades', subpagina: 'minhas-atividades' },
    { Icon: Bookmark, label: 'Salvos', subpagina: 'salvos' },
    { Icon: Scale, label: 'Histórico de Decisões', subpagina: 'historico-decisoes' },
    { Icon: Settings, label: 'Configurações', subpagina: 'configuracoes' },
    { Icon: LogOut, label: 'Sair', acao: 'logout' },
  ])
  return base.filter((item) => (item.condicional ? item.condicional(ctx) : true))
}

/**
 * @param {MenuContext} ctx
 * @returns {MenuItem[]}
 */
function itensEmpresa() {
  return [
    { Icon: Building2, label: 'Menu Empresa', href: '/empresa/menu/publicidade' },
    { Icon: Megaphone, label: 'Publicidade', href: '/empresa/menu/publicidade' },
    { Icon: MessageSquare, label: 'Chat ADM', href: '/empresa/menu/chat-adm' },
    { Icon: AlertTriangle, label: 'Denúncias', href: '/empresa/menu/denuncias' },
    { Icon: ShoppingCart, label: 'Compras Paraguai', href: '/empresa/menu/compras-paraguai' },
    { Icon: Gem, label: 'Planos', href: '/empresa/menu/planos' },
    { Icon: LogOut, label: 'Sair', acao: 'logout' },
  ]
}

/**
 * @param {MenuContext} ctx
 * @returns {MenuItem[]}
 */
function itensAdmin(ctx) {
  const base = /** @type {MenuItem[]} */ ([
    { Icon: LayoutDashboard, label: 'Dashboard ADM', href: '/dashboard/admin' },
    {
      Icon: Users,
      label: 'Modo Apresentação',
      subitens: [
        { Icon: User, label: 'Turista', acao: 'simulacao', simRole: 'turista' },
        { Icon: Car, label: 'Profissional', acao: 'simulacao', simRole: 'profissional' },
        { Icon: Building2, label: 'Empresa', acao: 'simulacao', simRole: 'empresa' },
      ],
      condicional: (c) => c.adminLevel === 1,
    },
    { Icon: User, label: 'Editar Perfil', subpagina: 'editar-perfil' },
    {
      Icon: History,
      label: 'Meu Histórico',
      subitens: [
        { Icon: Handshake, label: 'Parcerias', subpagina: 'parcerias' },
        { Icon: Speaker, label: 'Recomendações', subpagina: 'recomendacoes' },
        { Icon: Car, label: 'Contratações', subpagina: 'contratacoes' },
        { Icon: ShoppingBag, label: 'Compras', subpagina: 'compras' },
      ],
    },
    { Icon: Activity, label: 'Minhas Atividades', subpagina: 'minhas-atividades' },
    { Icon: Bookmark, label: 'Salvos', subpagina: 'salvos' },
    { Icon: Scale, label: 'Histórico de Decisões', subpagina: 'historico-decisoes' },
    { Icon: Settings, label: 'Configurações', subpagina: 'configuracoes' },
    { Icon: LogOut, label: 'Sair', acao: 'logout' },
  ])
  return base.filter((item) => (item.condicional ? item.condicional(ctx) : true))
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
}) {
  const router = useRouter()
  /** @type {[HistoricoEntry[], (h: HistoricoEntry[]) => void]} */
  const [historico, setHistorico] = useState(/** @type {HistoricoEntry[]} */ ([]))
  const [modalLogout, setModalLogout] = useState(false)
  const [historicoNaoLido, setHistoricoNaoLido] = useState(0)
  const [drawerEntered, setDrawerEntered] = useState(false)
  const { historico: historicoDecisoes, fetchHistoricoUsuario } = useInfracoes()

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
    if (!aberto || !usuarioId) return
    void fetchHistoricoUsuario(usuarioId)
  }, [aberto, fetchHistoricoUsuario, usuarioId])

  /** Evita scroll da página por trás e “roubo” do gesto no mobile (scrollbar que volta sozinha). */
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

  const ctx = { variant: variant || 'turista', placaVermelha, adminLevel }

  const itensRaiz = (() => {
    if (!variant) return []
    if (variant === 'turista') return itensTurista()
    if (variant === 'profissional') return itensProfissional(ctx)
    if (variant === 'empresa') return itensEmpresa()
    if (variant === 'admin') return itensAdmin(ctx)
    return []
  })()

  /** Remove um nível do stack (ex.: publicação isolada → Minhas Atividades → menu raiz). */
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

  const iniciarSimulacao = (role) => {
    try {
      localStorage.setItem('guia3f_modo_apresentacao', role)
      sessionStorage.setItem('guia3f_modo_apresentacao', role)
    } catch {
      /* ignore */
    }
    onFechar()
    window.location.href = '/guia'
  }

  const executarItem = (item) => {
    if (item.acao === 'logout') {
      setModalLogout(true)
      return
    }
    if (item.acao === 'simulacao' && item.simRole) {
      iniciarSimulacao(item.simRole)
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
        salvos: 'Salvos',
      }
      const t = titulos[item.subpagina] || item.label
      if (item.subpagina === 'historico-decisoes') {
        const unreadIds = (historicoDecisoes ?? []).filter((h) => !h.visualizado).map((h) => h.id)
        if (unreadIds.length > 0) {
          void Promise.all(unreadIds.map((id) => supabase.from('historico_decisoes').update({ visualizado: true }).eq('id', id))).then(() => {
            setHistoricoNaoLido(0)
            void fetchHistoricoUsuario(usuarioId || undefined)
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

  const renderPagina = () => {
    if (!topo || topo.tipo !== 'pagina' || !usuarioId) return null
    const id = topo.id
    const histTipo = topo.historicoTipo || 'contratacoes'

    if (id === 'emergencia') return <Emergencia />
    if (id === 'editar-perfil')
      return (
        <EditarPerfil
          usuarioId={usuarioId}
          role={variant === 'admin' ? 'admin' : variant === 'profissional' ? 'profissional' : 'turista'}
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
          usuarioId={usuarioId}
          onAbrirPublicacao={(postId, comentarioId = null) => {
            setHistorico((h) => [
              ...h,
              {
                tipo: 'pagina',
                titulo: 'Publicação',
                id: 'post-isolado',
                postId,
                comentarioId: comentarioId ?? null,
              },
            ])
          }}
        />
      )
    if (id === 'post-isolado' && topo && 'postId' in topo && topo.postId)
      return <PostIsoladoDrawer postId={String(topo.postId)} comentarioId={topo.comentarioId ?? null} />
    if (id === 'salvos') return <SalvosDrawer usuarioId={usuarioId} />
    if (id === 'configuracoes') return <Configuracoes />
    if (id === 'comissoes') return <Comissoes />
    if (id === 'agendamento') return <AgendamentoAutomatico />
    if (id === 'tabela') return <TabelaValores />
    if (id === 'manifestos') return <MeusManifestos />
    if (id === 'meu-historico') return <MeuHistorico tipo={histTipo} />
    if (id === 'historico-decisoes') return <HistoricoDecisoes />
    if (id === 'editar-pagina' && empresa && empresaId)
      return <EditarPaginaEmpresa empresa={empresa} empresaId={empresaId} onSalvo={onPerfilAtualizado} />
    if (id === 'cadastrar-comissao' && empresaId) return <CadastrarComissao empresaId={empresaId} />
    return <p className="text-sm text-gray-500">Página indisponível.</p>
  }

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
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-gray-800 transition hover:bg-gray-100"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-700" aria-hidden>
              <Ico size={20} strokeWidth={1.75} />
            </span>
            <span className="flex-1">{item.label}</span>
            {(item.badge ?? (item.subpagina === 'historico-decisoes' ? historicoNaoLido : 0)) > 0 ? (
              <span className="rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white">
                {item.badge ?? (item.subpagina === 'historico-decisoes' ? historicoNaoLido : 0)}
              </span>
            ) : null}
          </button>
        </li>
        )
      })}
    </ul>
  )

  if (!aberto || !variant) return null

  const mostrarVoltar = historico.length > 0

  return (
    <div className="fixed inset-0 z-50 max-h-[100dvh]">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Fechar menu" onClick={onFechar} />
      <aside
        className={`absolute right-0 top-0 flex h-full max-h-[100dvh] w-[75%] min-w-0 flex-col overflow-hidden bg-white shadow-xl transition-transform duration-300 ease-out ${
          drawerEntered ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Menu lateral"
      >
        <div
          className={`flex shrink-0 justify-end ${mostrarVoltar ? 'p-2 pb-0' : 'px-2 pt-0 pb-0'}`}
        >
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
              {variant === 'admin' || adminLevel >= 1 ? (
                <p className="mt-2 text-xs font-semibold text-amber-700">ADMIN</p>
              ) : null}
            </div>

            <nav className="scrollbar-perfil min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-3 pt-0 pb-3">
              {renderListaItens(itensRaiz)}
            </nav>
          </>
        ) : topo.tipo === 'menu' ? (
          <nav className="scrollbar-perfil min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-3 pt-1 pb-3">
            {renderListaItens(topo.itens)}
          </nav>
        ) : (
          <div className="scrollbar-perfil min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-3 pt-1 pb-3">
            {renderPagina()}
          </div>
        )}

        {modalLogout ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
              <h3 className="text-lg font-bold text-gray-900">Sair da conta?</h3>
              <p className="mt-2 text-sm text-gray-600">
                Você precisará entrar novamente para acessar o Guia 3F.
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-medium"
                  onClick={() => setModalLogout(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white"
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
