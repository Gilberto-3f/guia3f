'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { ArrowLeft, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useInfracoes } from '@/app/(admin)/dashboard/admin/hooks/useInfracoes'

import Emergencia from '@/components/perfil/subpaginas/Emergencia'
import EditarPerfil from '@/components/perfil/subpaginas/EditarPerfil'
import MeuHistorico from '@/components/perfil/subpaginas/MeuHistorico'
import MinhasAtividades from '@/components/perfil/subpaginas/MinhasAtividades'
import Configuracoes from '@/components/perfil/subpaginas/Configuracoes'
import Comissoes from '@/components/perfil/subpaginas/Comissoes'
import AgendamentoAutomatico from '@/components/perfil/subpaginas/AgendamentoAutomatico'
import TabelaValores from '@/components/perfil/subpaginas/TabelaValores'
import MeusManifestos from '@/components/perfil/subpaginas/MeusManifestos'
import EditarPaginaEmpresa from '@/components/perfil/subpaginas/EditarPaginaEmpresa'
import CadastrarComissao from '@/components/perfil/subpaginas/CadastrarComissao'
import HistoricoDecisoes from '@/components/perfil/subpaginas/HistoricoDecisoes'

/**
 * @typedef {{ tipo: 'menu', titulo: string, itens: MenuItem[] } | { tipo: 'pagina', titulo: string, id: string, historicoTipo?: string }} HistoricoEntry
 */

/**
 * @typedef {{
 *   icon: string
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
 * @param {MenuContext} ctx
 * @returns {MenuItem[]}
 */
function itensTurista() {
  return [
    { icon: '🆘', label: 'EMERGÊNCIA', subpagina: 'emergencia' },
    { icon: '👤', label: 'Editar Perfil', subpagina: 'editar-perfil' },
    {
      icon: '📜',
      label: 'Meu Histórico',
      subitens: [
        { icon: '🚗', label: 'Contratações', subpagina: 'contratacoes' },
        { icon: '🛒', label: 'Compras', subpagina: 'compras' },
      ],
    },
    { icon: '👤', label: 'Minhas Atividades', subpagina: 'minhas-atividades' },
    { icon: '🛡️', label: 'Histórico de Decisões', subpagina: 'historico-decisoes' },
    { icon: '🔔', label: 'Configurações', subpagina: 'configuracoes' },
    { icon: '🚪', label: 'Sair', acao: 'logout' },
  ]
}

/**
 * @param {MenuContext} ctx
 * @returns {MenuItem[]}
 */
function itensProfissional(ctx) {
  const base = /** @type {MenuItem[]} */ ([
    { icon: '💰', label: 'Comissões', subpagina: 'comissoes' },
    {
      icon: '⭐',
      label: 'Profissionais do Turismo',
      subitens: [
        { icon: '📅', label: 'Agendamento Automático', subpagina: 'agendamento' },
        { icon: '💰', label: 'Tabela de Valores', subpagina: 'tabela' },
        { icon: '📋', label: 'Meus Manifestos', subpagina: 'manifestos' },
      ],
      condicional: (c) => c.placaVermelha === true,
    },
    { icon: '👤', label: 'Editar Perfil', subpagina: 'editar-perfil' },
    {
      icon: '📜',
      label: 'Meu Histórico',
      subitens: [
        { icon: '🤝', label: 'Parcerias', subpagina: 'parcerias' },
        { icon: '📢', label: 'Recomendações', subpagina: 'recomendacoes' },
        { icon: '🚗', label: 'Contratações', subpagina: 'contratacoes' },
        { icon: '🛒', label: 'Compras', subpagina: 'compras' },
      ],
    },
    { icon: '👤', label: 'Minhas Atividades', subpagina: 'minhas-atividades' },
    { icon: '🛡️', label: 'Histórico de Decisões', subpagina: 'historico-decisoes' },
    { icon: '🔔', label: 'Configurações', subpagina: 'configuracoes' },
    { icon: '🚪', label: 'Sair', acao: 'logout' },
  ])
  return base.filter((item) => (item.condicional ? item.condicional(ctx) : true))
}

/**
 * @param {MenuContext} ctx
 * @returns {MenuItem[]}
 */
function itensEmpresa() {
  return [
    { icon: '🏢', label: 'Menu Empresa', href: '/empresa/menu/publicidade' },
    { icon: '📢', label: 'Publicidade', href: '/empresa/menu/publicidade' },
    { icon: '💬', label: 'Chat ADM', href: '/empresa/menu/chat-adm' },
    { icon: '⚠️', label: 'Denúncias', href: '/empresa/menu/denuncias' },
    { icon: '🛍️', label: 'Compras Paraguai', href: '/empresa/menu/compras-paraguai' },
    { icon: '💎', label: 'Planos', href: '/empresa/menu/planos' },
    { icon: '🚪', label: 'Sair', acao: 'logout' },
  ]
}

/**
 * @param {MenuContext} ctx
 * @returns {MenuItem[]}
 */
function itensAdmin(ctx) {
  const base = /** @type {MenuItem[]} */ ([
    { icon: '📊', label: 'Dashboard ADM', href: '/dashboard/admin' },
    {
      icon: '🎭',
      label: 'Modo Apresentação',
      subitens: [
        { icon: '👤', label: 'Turista', acao: 'simulacao', simRole: 'turista' },
        { icon: '🚗', label: 'Profissional', acao: 'simulacao', simRole: 'profissional' },
        { icon: '🏢', label: 'Empresa', acao: 'simulacao', simRole: 'empresa' },
      ],
      condicional: (c) => c.adminLevel === 1,
    },
    { icon: '👤', label: 'Editar Perfil', subpagina: 'editar-perfil' },
    {
      icon: '📜',
      label: 'Meu Histórico',
      subitens: [
        { icon: '🤝', label: 'Parcerias', subpagina: 'parcerias' },
        { icon: '📢', label: 'Recomendações', subpagina: 'recomendacoes' },
        { icon: '🚗', label: 'Contratações', subpagina: 'contratacoes' },
        { icon: '🛒', label: 'Compras', subpagina: 'compras' },
      ],
    },
    { icon: '👤', label: 'Minhas Atividades', subpagina: 'minhas-atividades' },
    { icon: '🛡️', label: 'Histórico de Decisões', subpagina: 'historico-decisoes' },
    { icon: '🔔', label: 'Configurações', subpagina: 'configuracoes' },
    { icon: '🚪', label: 'Sair', acao: 'logout' },
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
  const [logoutEtapa, setLogoutEtapa] = useState(0)
  const [modalLogout, setModalLogout] = useState(false)
  const [historicoNaoLido, setHistoricoNaoLido] = useState(0)
  const { historico: historicoDecisoes, fetchHistoricoUsuario } = useInfracoes()

  useEffect(() => {
    if (!aberto) {
      setHistorico([])
      setLogoutEtapa(0)
      setModalLogout(false)
    }
  }, [aberto])

  useEffect(() => {
    if (!aberto || !usuarioId) return
    void fetchHistoricoUsuario(usuarioId)
  }, [aberto, fetchHistoricoUsuario, usuarioId])

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

  const voltar = useCallback(() => {
    setHistorico((h) => {
      const n = [...h]
      n.pop()
      return n
    })
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
      setLogoutEtapa(0)
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

  const confirmarLogoutPasso = async () => {
    if (logoutEtapa === 0) {
      setLogoutEtapa(1)
      return
    }
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
      setLogoutEtapa(0)
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
          onSalvo={onPerfilAtualizado}
        />
      )
    if (id === 'minhas-atividades') return <MinhasAtividades usuarioId={usuarioId} />
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
      {lista.map((item, idx) => (
        <li key={`${item.label}-${idx}`}>
          <button
            type="button"
            onClick={() => executarItem(item)}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-gray-800 transition hover:bg-gray-100"
          >
            <span className="text-lg" aria-hidden>
              {item.icon}
            </span>
            <span className="flex-1">{item.label}</span>
            {(item.badge ?? (item.subpagina === 'historico-decisoes' ? historicoNaoLido : 0)) > 0 ? (
              <span className="rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white">
                {item.badge ?? (item.subpagina === 'historico-decisoes' ? historicoNaoLido : 0)}
              </span>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  )

  if (!aberto || !variant) return null

  const tituloHeader = topo ? (topo.tipo === 'menu' ? topo.titulo : topo.titulo) : 'Menu'
  const mostrarVoltar = historico.length > 0

  return (
    <div className="fixed inset-0 z-[200] flex justify-end">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Fechar menu" onClick={onFechar} />
      <aside className="relative flex h-full w-[min(100%,360px)] flex-col bg-white shadow-2xl transition-transform duration-200 ease-out">
        <div className="flex items-center gap-2 border-b border-gray-200 p-3">
          {mostrarVoltar ? (
            <button type="button" onClick={voltar} className="rounded-full p-2 hover:bg-gray-100" aria-label="Voltar">
              <ArrowLeft size={22} className="text-gray-700" />
            </button>
          ) : (
            <span className="w-10" />
          )}
          <span className="flex-1 truncate text-center text-sm font-semibold text-gray-900">{tituloHeader}</span>
          <button type="button" onClick={onFechar} className="rounded-full p-2 hover:bg-gray-100" aria-label="Fechar">
            <X size={22} />
          </button>
        </div>

        {!topo ? (
          <>
            <div className="border-b border-gray-100 px-4 py-4">
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
                <p className="mt-2 text-xs font-semibold text-amber-700">👑 ADMIN</p>
              ) : null}
            </div>

            <nav className="scrollbar-perfil flex-1 overflow-y-auto p-3">{renderListaItens(itensRaiz)}</nav>
          </>
        ) : topo.tipo === 'menu' ? (
          <nav className="scrollbar-perfil flex-1 overflow-y-auto p-3">{renderListaItens(topo.itens)}</nav>
        ) : (
          <div className="scrollbar-perfil flex-1 overflow-y-auto p-3">{renderPagina()}</div>
        )}

        {modalLogout ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
              <h3 className="text-lg font-bold text-gray-900">{logoutEtapa === 0 ? 'Sair da conta?' : 'Confirmação final'}</h3>
              <p className="mt-2 text-sm text-gray-600">
                {logoutEtapa === 0
                  ? 'Você precisará entrar novamente para acessar o Guia 3F.'
                  : 'Esta ação encerra a sessão neste dispositivo. Deseja continuar?'}
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-medium"
                  onClick={() => {
                    setModalLogout(false)
                    setLogoutEtapa(0)
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white"
                  onClick={() => void confirmarLogoutPasso()}
                >
                  {logoutEtapa === 0 ? 'Sim, sair' : 'Confirmar saída'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  )
}
