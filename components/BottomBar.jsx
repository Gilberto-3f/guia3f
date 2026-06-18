'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  Home,
  MessageCircle,
  Menu,
  Plus,
  Heart,
  User,
  Building2,
  LayoutDashboard,
  Car,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'
import { atividadeVisivelNaMinhaContaPessoal } from '@/lib/atividades-feed'
import { GUIA_ATIVIDADES_BADGE_EVENT } from '@/lib/atividades-events'
import { GUIA_CANAIS_BADGE_EVENT } from '@/lib/canais-badge-events'
import { GUIA_FUNIL_BADGE_EVENT } from '@/lib/dashboard-funil-badge-events'
import { contarMensagensNaoLidasCanais } from '@/lib/canalBadge'
import { contarNaoLidasFunilEmpresa } from '@/lib/dashboardFunilBadge'
import { useGateComprasReservas } from '@/lib/useGateComprasReservas'
import { useGateFeedSocial } from '@/lib/useGateFeedSocial'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import PopupAvisoBloqueioConta from '@/components/PopupAvisoBloqueioConta'

/**
 * @param {string} path
 * @param {string | null} pathname
 */
/**
 * Feed “Atividades” (coração), não confundir com /perfil/atividades (post isolado no drawer).
 * @param {string | null} pathname
 */
function isBarraAtividades(pathname) {
  if (!pathname) return false
  if (pathname.includes('/perfil/atividades')) return false
  return pathname === '/atividades' || pathname.endsWith('/atividades') || pathname.includes('/atividades/')
}

/**
 * Badge do coração deve contar a mesma lista exibida em Atividades > Minha Conta.
 * @param {string} userId
 */
async function contarAtividadesMinhaContaNaoLidas(userId) {
  if (!userId) return 0
  const { data, error } = await supabase
    .from('atividades')
    .select('id, tipo, dados_extras, autor_id, usuario_id')
    .eq('usuario_id', userId)
    .neq('autor_id', userId)
    .eq('lida', false)
    .not('tipo', 'in', '(avaliou,seguiu_empresa)')
    .limit(1000)
  if (error || !data) return 0
  return data.filter((row) => atividadeVisivelNaMinhaContaPessoal(row, userId)).length
}

function matchPath(path, pathname) {
  if (!pathname) return false
  if (path === '/guia' && pathname === '/guia') return true
  if (path === '/mobilidade' && (pathname === '/mobilidade' || pathname.startsWith('/mobilidade/')))
    return true
  if (path === '/canal' && (pathname === '/canal' || pathname.startsWith('/canal/'))) return true
  if (path === '/feed' && (pathname === '/feed' || pathname.startsWith('/feed/'))) return true
  if (path === '/atividades' && isBarraAtividades(pathname)) return true
  if (path === '/perfil' && (pathname === '/perfil' || pathname.startsWith('/perfil/'))) return true
  if (path === '/favoritos' && pathname === '/favoritos') return true
  if (path === '/dashboard/empresa' && pathname.startsWith('/dashboard/empresa')) return true
  if (path === '/empresa/menu' && pathname.startsWith('/empresa/menu')) return true
  if (path.startsWith('/empresa/') && pathname === path) return true
  return false
}

/** Badges pesados não bloqueiam a liberação da barra. */
const BADGE_DEFER_MS = 600

/**
 * @param {{ Icon: import('lucide-react').LucideIcon, label: string, className?: string, children?: import('react').ReactNode }} props
 */
function BarraIconeCarregando({ Icon, label, className = '', children = null }) {
  return (
    <div className="relative flex flex-col items-center p-2 opacity-50" aria-busy="true" aria-label={label}>
      <Icon size={24} className={`text-gray-300 ${className}`} aria-hidden />
      {children}
    </div>
  )
}

export default function BottomBar() {
  const t = useTranslations('BottomBar')
  const pathname = usePathname()
  const { modoAtivo, perfilSimulado, contextoEmpresaId, podeInteragir, notificarSomenteLeitura } = useModoApresentacao()
  const rootRef = useRef(/** @type {HTMLDivElement | null} */ (null))
  const { loading: gateLoading, userRole } = useProfissionalGate()
  const [empresaId, setEmpresaId] = useState(/** @type {string | null} */ (null))
  const [authUserId, setAuthUserId] = useState(/** @type {string | null} */ (null))
  const [authPronto, setAuthPronto] = useState(false)
  const [fotoPerfil, setFotoPerfil] = useState(/** @type {string | null} */ (null))
  const [naoLidasAtividades, setNaoLidasAtividades] = useState(0)
  const [naoLidasCanais, setNaoLidasCanais] = useState(0)
  const [naoLidasFunil, setNaoLidasFunil] = useState(0)

  /** Sessão Auth (leve) — role/condicionais vêm do ProfissionalGateContext. */
  useEffect(() => {
    let ativo = true

    const syncAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!ativo) return
      const uid = session?.user?.id ?? null
      setAuthUserId(uid)
      if (!uid) {
        setEmpresaId(null)
        setFotoPerfil(null)
        setNaoLidasAtividades(0)
        setNaoLidasCanais(0)
      }
      setAuthPronto(true)
    }

    void syncAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        void syncAuth()
      }
    })

    return () => {
      ativo = false
      subscription.unsubscribe()
    }
  }, [])

  /** Avatar e empresa_id não bloqueiam a barra — carregam após o gate. */
  useEffect(() => {
    if (gateLoading) return
    let ativo = true

    const carregarPerfilBarra = async () => {
      if (!authUserId) {
        if (ativo) {
          setEmpresaId(null)
          setFotoPerfil(null)
        }
        return
      }

      const role = userRole
      if (role === 'empresa') {
        const { data: empresa } = await supabase
          .from('empresas')
          .select('id, foto_url')
          .eq('usuario_id', authUserId)
          .maybeSingle()
        if (ativo) {
          setEmpresaId(empresa?.id ?? null)
          setFotoPerfil(empresa?.foto_url != null ? String(empresa.foto_url) : null)
        }
        return
      }

      if (ativo) setEmpresaId(null)

      if (role === 'turista') {
        const { data: perfil } = await supabase
          .from('turistas')
          .select('foto_perfil_url, foto_url')
          .eq('usuario_id', authUserId)
          .maybeSingle()
        if (ativo) {
          setFotoPerfil(
            perfil?.foto_perfil_url != null
              ? String(perfil.foto_perfil_url)
              : perfil?.foto_url != null
                ? String(perfil.foto_url)
                : null,
          )
        }
        return
      }

      if (role === 'profissional') {
        const { data: perfil } = await supabase
          .from('profissionais')
          .select('foto_perfil_url, foto_url')
          .eq('usuario_id', authUserId)
          .maybeSingle()
        if (ativo) {
          setFotoPerfil(
            perfil?.foto_perfil_url != null
              ? String(perfil.foto_perfil_url)
              : perfil?.foto_url != null
                ? String(perfil.foto_url)
                : null,
          )
        }
        return
      }

      if (role === 'admin') {
        const [profRes, turRes] = await Promise.all([
          supabase.from('profissionais').select('foto_perfil_url, foto_url').eq('usuario_id', authUserId).maybeSingle(),
          supabase.from('turistas').select('foto_perfil_url, foto_url').eq('usuario_id', authUserId).maybeSingle(),
        ])
        const prof = profRes.data
        const tur = turRes.data
        const url =
          prof?.foto_perfil_url != null
            ? String(prof.foto_perfil_url)
            : prof?.foto_url != null
              ? String(prof.foto_url)
              : tur?.foto_perfil_url != null
                ? String(tur.foto_perfil_url)
                : tur?.foto_url != null
                  ? String(tur.foto_url)
                  : null
        if (ativo) setFotoPerfil(url)
        return
      }

      if (ativo) setFotoPerfil(null)
    }

    void carregarPerfilBarra()

    const onPerfilAtualizado = () => {
      void carregarPerfilBarra()
    }
    window.addEventListener('perfil-atualizado', onPerfilAtualizado)

    return () => {
      ativo = false
      window.removeEventListener('perfil-atualizado', onPerfilAtualizado)
    }
  }, [gateLoading, authUserId, userRole])

  /** Feed social (`atividades`): badge do coração — nunca mistura com `mensagens_canal`. */
  useEffect(() => {
    if (!authUserId) return
    let ativo = true

    const refreshBadgeAtividades = async () => {
      const roleContagem =
        modoAtivo && perfilSimulado ? perfilSimulado.tipo : userRole === 'admin' ? 'admin' : userRole
      let usuarioIdContagemAtividades = authUserId
      if (roleContagem === 'empresa' && modoAtivo && contextoEmpresaId) {
        const { data: empGestor } = await supabase
          .from('empresas')
          .select('usuario_id')
          .eq('id', contextoEmpresaId)
          .maybeSingle()
        const g = empGestor?.usuario_id
        if (g != null && String(g).trim() !== '') usuarioIdContagemAtividades = String(g)
      }

      let total = 0
      if (roleContagem === 'empresa') {
        total = await contarAtividadesMinhaContaNaoLidas(usuarioIdContagemAtividades)
      } else if (userRole != null) {
        total = await contarAtividadesMinhaContaNaoLidas(authUserId)
      }
      if (ativo) setNaoLidasAtividades(total)
    }

    const onBadge = () => {
      void refreshBadgeAtividades()
    }
    window.addEventListener(GUIA_ATIVIDADES_BADGE_EVENT, onBadge)

    const deferId = setTimeout(() => {
      void refreshBadgeAtividades()
    }, BADGE_DEFER_MS)

    const chAtividades = supabase
      .channel(`bottom-bar-atividades-${authUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'atividades',
          filter: `usuario_id=eq.${authUserId}`,
        },
        (payload) => {
          const autor = payload.new?.autor_id != null ? String(payload.new.autor_id) : ''
          if (autor && autor === authUserId) return
          void refreshBadgeAtividades()
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'atividades',
          filter: `usuario_id=eq.${authUserId}`,
        },
        (payload) => {
          const autor = payload.new?.autor_id != null ? String(payload.new.autor_id) : ''
          if (autor && autor === authUserId) return
          void refreshBadgeAtividades()
        },
      )
      .subscribe()

    return () => {
      ativo = false
      clearTimeout(deferId)
      window.removeEventListener(GUIA_ATIVIDADES_BADGE_EVENT, onBadge)
      void supabase.removeChannel(chAtividades)
    }
  }, [authUserId, userRole, modoAtivo, perfilSimulado?.tipo, contextoEmpresaId])

  useEffect(() => {
    if (!authUserId) {
      setNaoLidasCanais(0)
      return
    }
    let cancelled = false
    /** @type {ReturnType<typeof setTimeout> | null} */
    let debounceId = null

    const refreshCanais = async () => {
      const n = await contarMensagensNaoLidasCanais(supabase, authUserId)
      if (!cancelled) setNaoLidasCanais(n)
    }

    const scheduleRefresh = () => {
      if (debounceId) clearTimeout(debounceId)
      debounceId = setTimeout(() => {
        debounceId = null
        void refreshCanais()
      }, 400)
    }

    const deferId = setTimeout(() => {
      void refreshCanais()
    }, BADGE_DEFER_MS)

    const onCanaisBadge = () => {
      scheduleRefresh()
    }
    window.addEventListener(GUIA_CANAIS_BADGE_EVENT, onCanaisBadge)

    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshCanais()
    }
    document.addEventListener('visibilitychange', onVisible)

    const channel = supabase
      .channel(`bottom-bar-mensagens-canal-${authUserId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensagens_canal' },
        (payload) => {
          const autor = payload.new?.remetente_id != null ? String(payload.new.remetente_id) : ''
          if (autor && autor === authUserId) return
          scheduleRefresh()
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ecossistema_mensagens' },
        (payload) => {
          const autor = payload.new?.remetente_id != null ? String(payload.new.remetente_id) : ''
          if (autor && autor === authUserId) return
          scheduleRefresh()
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'canal_leitura_profissional',
          filter: `usuario_id=eq.${authUserId}`,
        },
        () => {
          scheduleRefresh()
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'canal_leitura_profissional',
          filter: `usuario_id=eq.${authUserId}`,
        },
        () => {
          scheduleRefresh()
        },
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'canal_financeiro' }, () => {
        scheduleRefresh()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'canal_financeiro' }, () => {
        scheduleRefresh()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'financeiro_mensagens' }, () => {
        scheduleRefresh()
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'financeiro_conversa_leitura',
          filter: `usuario_id=eq.${authUserId}`,
        },
        () => {
          scheduleRefresh()
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void refreshCanais()
      })

    return () => {
      cancelled = true
      clearTimeout(deferId)
      if (debounceId) clearTimeout(debounceId)
      window.removeEventListener(GUIA_CANAIS_BADGE_EVENT, onCanaisBadge)
      document.removeEventListener('visibilitychange', onVisible)
      void supabase.removeChannel(channel)
    }
  }, [authUserId])

  /** Badge agregado do funil (recomendações + PAX + vendas) no dashboard empresa. */
  useEffect(() => {
    const ehEmpresa =
      (modoAtivo && perfilSimulado?.tipo === 'empresa' && contextoEmpresaId) || userRole === 'empresa'
    const empId =
      modoAtivo && perfilSimulado?.tipo === 'empresa' && contextoEmpresaId ? contextoEmpresaId : empresaId

    if (!ehEmpresa || !empId || !authUserId) {
      setNaoLidasFunil(0)
      return
    }

    let cancelled = false
    const refresh = async () => {
      const c = await contarNaoLidasFunilEmpresa(supabase, empId, authUserId)
      if (!cancelled) setNaoLidasFunil(c.total)
    }

    const deferId = setTimeout(() => {
      void refresh()
    }, BADGE_DEFER_MS)

    const onFunil = (event) => {
      const total = event?.detail?.total
      if (typeof total === 'number' && Number.isFinite(total)) {
        setNaoLidasFunil(total)
        return
      }
      void refresh()
    }
    window.addEventListener(GUIA_FUNIL_BADGE_EVENT, onFunil)

    const chFunil = supabase
      .channel(`bottom-bar-funil-${empId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'recomendacoes', filter: `empresa_id=eq.${empId}` },
        onFunil,
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'manifesto',
          filter: `empresa_destino_id=eq.${empId}`,
        },
        onFunil,
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comissao', filter: `empresa_id=eq.${empId}` },
        onFunil,
      )
      .subscribe()

    return () => {
      cancelled = true
      clearTimeout(deferId)
      window.removeEventListener(GUIA_FUNIL_BADGE_EVENT, onFunil)
      void supabase.removeChannel(chFunil)
    }
  }, [authUserId, userRole, empresaId, modoAtivo, perfilSimulado?.tipo, contextoEmpresaId])

  /** Ao navegar entre telas, reconta (fallback se Realtime ainda não estiver na publication). */
  const prevPathnameRef = useRef(/** @type {string | null} */ (null))
  useEffect(() => {
    if (!authUserId) return

    const prev = prevPathnameRef.current
    prevPathnameRef.current = pathname ?? null

    const saiuDoDetalheCanal =
      prev != null && /\/canal\/[^/]+/.test(prev) && (pathname == null || !/\/canal\/[^/]+/.test(pathname))

    const refresh = () => {
      void contarMensagensNaoLidasCanais(supabase, authUserId).then((n) => setNaoLidasCanais(n))
    }

    if (saiuDoDetalheCanal) {
      const t = setTimeout(refresh, 700)
      return () => clearTimeout(t)
    }

    refresh()
  }, [pathname, authUserId])

  /**
   * Safari iOS move `position: fixed; bottom: 0` com o teclado; compensamos fora de `/feed/criar`,
   * onde a barra é ocultada com o teclado (evita conflito com scroll da legenda).
   */
  useLayoutEffect(() => {
    if (!pathname || pathname.includes('/feed/criar')) return
    const vv = window.visualViewport
    const el = rootRef.current
    if (!vv || !el) return

    const sync = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      el.style.transform = inset > 0 ? `translate3d(0, ${inset}px, 0)` : ''
    }

    sync()
    vv.addEventListener('resize', sync)
    vv.addEventListener('scroll', sync)
    window.addEventListener('resize', sync)
    return () => {
      vv.removeEventListener('resize', sync)
      vv.removeEventListener('scroll', sync)
      window.removeEventListener('resize', sync)
      el.style.transform = ''
    }
  }, [pathname])

  const isFeedPage = pathname === '/feed'

  const roleParaBarra =
    modoAtivo && perfilSimulado ? perfilSimulado.tipo : userRole === 'admin' ? 'admin' : userRole
  const isEmpresaBar = roleParaBarra === 'empresa'
  const empresaIdBar =
    isEmpresaBar && modoAtivo && contextoEmpresaId ? contextoEmpresaId : userRole === 'empresa' ? empresaId : null

  /** Turistas: Mobilidade no 2.º slot; demais perfis logados ou simulados: Canal. */
  const segundoEhMobilidadeNaBarra = roleParaBarra === 'turista'
  const {
    podeComprarReservar,
    avisarBloqueio,
    avisoAberto,
    fecharAvisoBloqueio,
    mensagemBloqueio,
    tituloBloqueio,
    loading: gateComprasLoading,
  } = useGateComprasReservas()
  const {
    podeInteragirFeedSocial,
    avisarBloqueioFeed,
    avisoFeedAberto,
    fecharAvisoBloqueioFeed,
    mensagemBloqueioFeed,
    tituloBloqueioFeed,
    loading: gateFeedLoading,
  } = useGateFeedSocial()

  const getTerceiroHref = () => {
    if (isFeedPage) return '/feed/criar'
    return '/feed'
  }

  const terceiroActive = isFeedPage || pathname === '/feed/criar'

  const isQuartoActive = () => isBarraAtividades(pathname)

  const getQuintoHref = () => {
    if (isEmpresaBar) {
      return empresaIdBar ? `/empresa/${empresaIdBar}` : '/dashboard/empresa'
    }
    if (authUserId && (userRole === 'turista' || userRole === 'profissional' || userRole === 'admin'))
      return `/perfil/${authUserId}`
    return '/perfil'
  }

  const isQuintoActive = () => {
    if (isEmpresaBar) {
      return Boolean(empresaIdBar && pathname != null && pathname === `/empresa/${empresaIdBar}`)
    }
    return pathname === '/perfil' || (pathname != null && pathname.startsWith('/perfil/'))
  }

  const barPronta = authPronto && !gateLoading

  const getQuintoIcone = () => {
    const active = isQuintoActive()

    if (fotoPerfil) {
      return (
        <div
          className={`relative h-6 w-6 overflow-hidden rounded-md ${active ? 'ring-2 ring-[#0097b2] ring-offset-2' : ''}`}
        >
          <Image src={fotoPerfil} alt="Perfil" width={24} height={24} className="h-full w-full object-cover" />
        </div>
      )
    }

    if (isEmpresaBar) {
      return <Building2 size={24} className={active ? 'text-[#0097b2]' : 'text-gray-400'} aria-hidden />
    }
    return <User size={24} className={active ? 'text-[#0097b2]' : 'text-gray-400'} aria-hidden />
  }

  return (
    <div
      ref={rootRef}
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white shadow-lg will-change-transform"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around py-2">
        {!barPronta ? (
          <BarraIconeCarregando Icon={Home} label={t('loadingBar')} />
        ) : (
          <Link href="/guia" className="flex flex-col items-center p-2" aria-label={t('home')}>
            <Home size={24} className={matchPath('/guia', pathname) ? 'text-[#0097b2]' : 'text-gray-400'} />
          </Link>
        )}

        {!barPronta ? (
          <BarraIconeCarregando
            Icon={segundoEhMobilidadeNaBarra ? Car : MessageCircle}
            label={t('loadingBar')}
          />
        ) : segundoEhMobilidadeNaBarra ? (
          podeComprarReservar || gateComprasLoading ? (
            <Link href="/mobilidade" className="flex flex-col items-center p-2" aria-label={t('mobility')}>
              <Car
                size={24}
                className={matchPath('/mobilidade', pathname) ? 'text-[#0097b2]' : 'text-gray-400'}
                aria-hidden
              />
            </Link>
          ) : (
            <button
              type="button"
              className="flex flex-col items-center p-2"
              aria-label={t('mobility')}
              onClick={() => avisarBloqueio()}
            >
              <Car size={24} className="text-gray-400" aria-hidden />
            </button>
          )
        ) : (
          <Link href="/canal" className="relative flex flex-col items-center p-2" aria-label={t('channel')}>
            <MessageCircle
              size={24}
              className={matchPath('/canal', pathname) ? 'text-[#0097b2]' : 'text-gray-400'}
              aria-hidden
            />
            {authUserId && naoLidasCanais > 0 ? (
              <span className="absolute right-0 top-0 flex min-h-[14px] min-w-[14px] max-w-[2rem] translate-x-1/4 -translate-y-1/4 items-center justify-center rounded-full bg-[#F44336] px-0.5 text-[9px] font-bold leading-none text-white tabular-nums">
                {naoLidasCanais > 99 ? '99+' : naoLidasCanais}
              </span>
            ) : null}
          </Link>
        )}

        {!barPronta ? (
          isFeedPage && roleParaBarra !== 'empresa' ? (
            <div className="flex flex-col items-center p-0 opacity-50" aria-busy="true" aria-label={t('loadingBar')}>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200" aria-hidden />
            </div>
          ) : (
            <BarraIconeCarregando
              Icon={roleParaBarra === 'empresa' ? LayoutDashboard : Menu}
              label={t('loadingBar')}
            />
          )
        ) : isEmpresaBar ? (
          <Link
            href="/dashboard/empresa"
            className="relative flex flex-col items-center p-2"
            aria-label={t('dashboard')}
          >
            <LayoutDashboard
              size={24}
              className={
                pathname != null && pathname.startsWith('/dashboard/empresa')
                  ? 'text-[#0097b2]'
                  : 'text-gray-400'
              }
              aria-hidden
            />
            {authUserId && naoLidasFunil > 0 ? (
              <span className="absolute right-0 top-0 flex min-h-[14px] min-w-[14px] max-w-[2rem] translate-x-1/4 -translate-y-1/4 items-center justify-center rounded-full bg-[#F44336] px-0.5 text-[9px] font-bold leading-none text-white tabular-nums">
                {naoLidasFunil > 99 ? '99+' : naoLidasFunil}
              </span>
            ) : null}
          </Link>
        ) : isFeedPage && !podeInteragirFeedSocial && !gateFeedLoading ? (
          <button
            type="button"
            className="flex flex-col items-center p-0"
            aria-label={t('newPost')}
            onClick={() => {
              if (!podeInteragir) {
                notificarSomenteLeitura()
                return
              }
              avisarBloqueioFeed()
            }}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0097b2] shadow-lg">
              <Plus className="h-5 w-5 text-white" strokeWidth={2.5} aria-hidden />
            </span>
          </button>
        ) : (
          <Link
            href={getTerceiroHref()}
            onClick={(e) => {
              if (!podeInteragir && isFeedPage) {
                e.preventDefault()
                notificarSomenteLeitura()
              }
            }}
            className={`flex flex-col items-center ${isFeedPage ? 'p-0' : 'p-2'}`}
            aria-label={isFeedPage ? t('newPost') : t('feed')}
          >
            {isFeedPage ? (
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0097b2] shadow-lg">
                <Plus className="h-5 w-5 text-white" strokeWidth={2.5} aria-hidden />
              </span>
            ) : (
              <span className={terceiroActive ? 'text-[#0097b2]' : 'text-gray-400'}>
                <Menu size={24} aria-hidden />
              </span>
            )}
          </Link>
        )}

        {!barPronta ? (
          <BarraIconeCarregando Icon={Heart} label={t('loadingBar')} />
        ) : (
          <Link href="/atividades" className="relative flex flex-col items-center p-2" aria-label={t('activities')}>
            <Heart size={24} className={isQuartoActive() ? 'text-[#0097b2]' : 'text-gray-400'} aria-hidden />
            {naoLidasAtividades > 0 ? (
              <span className="absolute right-0 top-0 flex min-h-[14px] min-w-[14px] max-w-[2rem] translate-x-1/4 -translate-y-1/4 items-center justify-center rounded-full bg-[#F44336] px-0.5 text-[9px] font-bold leading-none text-white tabular-nums">
                {naoLidasAtividades > 99 ? '99+' : naoLidasAtividades}
              </span>
            ) : null}
          </Link>
        )}

        {!barPronta ? (
          <BarraIconeCarregando Icon={User} label={t('loadingBar')} />
        ) : (
          <Link
            href={getQuintoHref()}
            prefetch={false}
            className="flex flex-col items-center p-2"
            aria-label={isEmpresaBar ? t('companyGuia') : t('profile')}
          >
            {getQuintoIcone()}
          </Link>
        )}
      </div>

      {segundoEhMobilidadeNaBarra ? (
        <PopupAvisoBloqueioConta
          aberto={avisoAberto}
          onFechar={fecharAvisoBloqueio}
          titulo={tituloBloqueio}
          mensagem={mensagemBloqueio}
        />
      ) : null}
      <PopupAvisoBloqueioConta
        aberto={avisoFeedAberto}
        onFechar={fecharAvisoBloqueioFeed}
        titulo={tituloBloqueioFeed}
        mensagem={mensagemBloqueioFeed}
      />
    </div>
  )
}
