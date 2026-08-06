'use client'

import Link from 'next/link'
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
  Star,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'
import { contarAtividadesMinhaContaNaoLidas } from '@/lib/atividades-feed'
import { GUIA_ATIVIDADES_BADGE_EVENT } from '@/lib/atividades-events'
import { GUIA_CANAIS_BADGE_EVENT } from '@/lib/canais-badge-events'
import { GUIA_FUNIL_BADGE_EVENT } from '@/lib/dashboard-funil-badge-events'
import { contarMensagensNaoLidasCanais, invalidarCacheBadgeCanais } from '@/lib/canalBadge'
import { contarNaoLidasFunilEmpresa } from '@/lib/dashboardFunilBadge'
import { empresaGestorTemPresencaVigenteCached } from '@/lib/empresaPresencaPublica'
import { useGateFeedSocial } from '@/lib/useGateFeedSocial'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import { useAnfitriaoModo } from '@/context/AnfitriaoModoContext'
import { profissionalOperaComoEmpresaHospedagem } from '@/lib/anfitriaoDualMode'
import { lerPerfilBarraCache } from '@/lib/perfilBarraCache'
import { resumirSessaoAposIdle } from '@/lib/authResume'
import PopupAvisoBloqueioConta from '@/components/PopupAvisoBloqueioConta'
import AvatarImage from '@/components/AvatarImage'

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
async function contarAtividadesMinhaContaNaoLidasLocal(userId, opts = {}) {
  if (!userId) return 0
  return contarAtividadesMinhaContaNaoLidas(supabase, userId, opts)
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
const BADGE_DEFER_MS = 2500
/** Fallback leve quando o utilizador não está em /canal (evita postgres_changes sem filtro). */
const CANAIS_BADGE_POLL_MS = 180_000
const ATIVIDADES_BADGE_POLL_MS = 180_000
const FUNIL_BADGE_POLL_MS = 180_000
/** Timeout curto — se o Postgres estiver saturado, desiste sem segurar a UI. */
const BADGE_QUERY_TIMEOUT_MS = 4_000

/**
 * @template T
 * @param {Promise<T>} promise
 * @param {T} fallback
 * @param {number} [ms]
 */
function withTimeout(promise, fallback, ms = BADGE_QUERY_TIMEOUT_MS) {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise((resolve) => {
      setTimeout(() => resolve(fallback), ms)
    }),
  ])
}

export default function BottomBar() {
  const t = useTranslations('BottomBar')
  const pathname = usePathname()
  const { modoAtivo, perfilSimulado, contextoEmpresaId, podeInteragir, notificarSomenteLeitura } = useModoApresentacao()
  const rootRef = useRef(/** @type {HTMLDivElement | null} */ (null))
  const { userRole, fotoPerfilBarra, empresaIdBarra } = useProfissionalGate()
  const { ehAnfitriao, modoEfetivo, empresaHospedagemId, empresaHospedagemLiberada, empresaHospedagem } = useAnfitriaoModo()
  const [empresaId, setEmpresaId] = useState(/** @type {string | null} */ (null))
  const [authUserId, setAuthUserId] = useState(() => lerPerfilBarraCache()?.userId ?? null)
  const [fotoPerfilCache, setFotoPerfilCache] = useState(/** @type {string | null} */ (() => {
    const c = lerPerfilBarraCache()
    return c?.fotoProfSocialUrl ?? c?.fotoUrl ?? null
  }))
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
        setFotoPerfilCache(null)
        setNaoLidasAtividades(0)
        setNaoLidasCanais(0)
      } else {
        const cached = lerPerfilBarraCache()
        if (cached?.userId === uid) {
          setFotoPerfilCache(cached.fotoProfSocialUrl ?? cached.fotoUrl ?? null)
        }
      }
    }

    void syncAuth()

    const onResume = () => {
      if (document.visibilityState !== 'visible') return
      // Não espera o refresh — evita travar a barra se Auth/DB estiver lento
      void resumirSessaoAposIdle()
      void syncAuth()
    }
    document.addEventListener('visibilitychange', onResume)
    window.addEventListener('pageshow', onResume)

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (
        event === 'SIGNED_IN' ||
        event === 'SIGNED_OUT' ||
        event === 'USER_UPDATED' ||
        event === 'TOKEN_REFRESHED'
      ) {
        void syncAuth()
      }
    })

    return () => {
      ativo = false
      document.removeEventListener('visibilitychange', onResume)
      window.removeEventListener('pageshow', onResume)
      subscription.unsubscribe()
    }
  }, [])

  /** Sincroniza avatar em cache quando o gate atualiza. */
  useEffect(() => {
    if (fotoPerfilBarra) setFotoPerfilCache(fotoPerfilBarra)
  }, [fotoPerfilBarra])

  /** Sincroniza empresa_id da barra com o gate (sem query extra). */
  useEffect(() => {
    if (userRole === 'empresa' && empresaIdBarra) {
      setEmpresaId(empresaIdBarra)
      return
    }
    if (
      userRole === 'profissional' &&
      profissionalOperaComoEmpresaHospedagem(userRole, ehAnfitriao, modoEfetivo, empresaHospedagemId, empresaHospedagemLiberada) &&
      empresaHospedagemId
    ) {
      setEmpresaId(empresaHospedagemId)
      return
    }
    if (userRole !== 'empresa') {
      setEmpresaId(null)
    }
  }, [userRole, empresaIdBarra, ehAnfitriao, modoEfetivo, empresaHospedagemId, empresaHospedagemLiberada])

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
        total = await withTimeout(
          contarAtividadesMinhaContaNaoLidasLocal(usuarioIdContagemAtividades, {
            modoHospedagem: true,
          }),
          0,
        )
      } else if (userRole != null) {
        total = await withTimeout(contarAtividadesMinhaContaNaoLidasLocal(authUserId), 0)
      }
      if (ativo) setNaoLidasAtividades(total)
    }

    const onBadge = (ev) => {
      if (ev instanceof CustomEvent && ev.detail?.zero === true) {
        setNaoLidasAtividades(0)
        return
      }
      void refreshBadgeAtividades()
    }
    window.addEventListener(GUIA_ATIVIDADES_BADGE_EVENT, onBadge)

    const deferId = setTimeout(() => {
      void refreshBadgeAtividades()
    }, BADGE_DEFER_MS)

    const pollId = setInterval(() => {
      if (document.visibilityState === 'visible') void refreshBadgeAtividades()
    }, ATIVIDADES_BADGE_POLL_MS)

    return () => {
      ativo = false
      clearTimeout(deferId)
      clearInterval(pollId)
      window.removeEventListener(GUIA_ATIVIDADES_BADGE_EVENT, onBadge)
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
      const n = await withTimeout(contarMensagensNaoLidasCanais(supabase, authUserId), 0)
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
      invalidarCacheBadgeCanais(authUserId)
      scheduleRefresh()
    }
    window.addEventListener(GUIA_CANAIS_BADGE_EVENT, onCanaisBadge)

    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshCanais()
    }
    document.addEventListener('visibilitychange', onVisible)

    /** Badge de canais: `GUIA_CANAIS_BADGE_EVENT` + poll (tabelas de leitura fora da publication Realtime). */
    const pollId = setInterval(() => {
      if (document.visibilityState === 'visible') scheduleRefresh()
    }, CANAIS_BADGE_POLL_MS)

    return () => {
      cancelled = true
      clearTimeout(deferId)
      clearInterval(pollId)
      if (debounceId) clearTimeout(debounceId)
      window.removeEventListener(GUIA_CANAIS_BADGE_EVENT, onCanaisBadge)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [authUserId])

  /** Badge agregado do funil (recomendações + PAX + vendas) no dashboard empresa. */
  useEffect(() => {
    const ehEmpresa =
      (modoAtivo && perfilSimulado?.tipo === 'empresa' && contextoEmpresaId) ||
      userRole === 'empresa' ||
      profissionalOperaComoEmpresaHospedagem(userRole, ehAnfitriao, modoEfetivo, empresaHospedagemId, empresaHospedagemLiberada)
    const empId =
      modoAtivo && perfilSimulado?.tipo === 'empresa' && contextoEmpresaId
        ? contextoEmpresaId
        : profissionalOperaComoEmpresaHospedagem(userRole, ehAnfitriao, modoEfetivo, empresaHospedagemId, empresaHospedagemLiberada)
          ? empresaHospedagemId ?? empresaId
          : empresaId

    if (!ehEmpresa || !empId || !authUserId) {
      setNaoLidasFunil(0)
      return
    }

    let cancelled = false
    const refresh = async () => {
      // Ciclo vencido: dashboard funil bloqueado — não gasta pool com counts.
      const vigente = await withTimeout(empresaGestorTemPresencaVigenteCached(supabase, authUserId), false)
      if (!vigente) {
        if (!cancelled) setNaoLidasFunil(0)
        return
      }
      const c = await withTimeout(
        contarNaoLidasFunilEmpresa(supabase, empId, authUserId),
        { total: 0, recomendacoes: 0, pax: 0, vendas: 0 },
      )
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

    const pollFunilId = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh()
    }, FUNIL_BADGE_POLL_MS)

    return () => {
      cancelled = true
      clearTimeout(deferId)
      clearInterval(pollFunilId)
      window.removeEventListener(GUIA_FUNIL_BADGE_EVENT, onFunil)
    }
  }, [authUserId, userRole, empresaId, modoAtivo, perfilSimulado?.tipo, contextoEmpresaId, ehAnfitriao, modoEfetivo, empresaHospedagemId, empresaHospedagemLiberada])

  /** Ao sair do detalhe do canal, reconta (não em toda navegação — evita tempestade em 503). */
  const prevPathnameRef = useRef(/** @type {string | null} */ (null))
  useEffect(() => {
    if (!authUserId) return

    const prev = prevPathnameRef.current
    prevPathnameRef.current = pathname ?? null

    const saiuDoDetalheCanal =
      prev != null && /\/canal\/[^/]+/.test(prev) && (pathname == null || !/\/canal\/[^/]+/.test(pathname))

    if (!saiuDoDetalheCanal) return

    const t = setTimeout(() => {
      void withTimeout(contarMensagensNaoLidasCanais(supabase, authUserId), 0).then((n) =>
        setNaoLidasCanais(n),
      )
    }, 700)
    return () => clearTimeout(t)
  }, [pathname, authUserId])

  /**
   * Safari iOS move `position: fixed; bottom: 0` com o teclado.
   * Em /feed/criar a barra é ocultada; em Guia/Mobilidade NÃO compensamos —
   * a barra não deve subir acima do teclado (tela permanece fixa).
   */
  useLayoutEffect(() => {
    if (!pathname || pathname.includes('/feed/criar')) return
    if (pathname.includes('/mobilidade') || pathname.includes('/guia')) return
    const vv = window.visualViewport
    const el = rootRef.current
    if (!vv || !el) return

    const sync = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      // -50% X: coluna centrada (left-1/2); Y: compensa teclado iOS.
      el.style.transform =
        inset > 0 ? `translate3d(-50%, ${inset}px, 0)` : 'translate3d(-50%, 0, 0)'
    }

    sync()
    vv.addEventListener('resize', sync)
    vv.addEventListener('scroll', sync)
    window.addEventListener('resize', sync)
    return () => {
      vv.removeEventListener('resize', sync)
      vv.removeEventListener('scroll', sync)
      window.removeEventListener('resize', sync)
      el.style.transform = 'translate3d(-50%, 0, 0)'
    }
  }, [pathname])

  const isFeedPage = pathname === '/feed'

  const roleParaBarra = (() => {
    const cached = authUserId ? lerPerfilBarraCache() : null
    const roleBase = userRole ?? (cached?.userId === authUserId ? cached.role : null)
    if (modoAtivo && perfilSimulado) return perfilSimulado.tipo
    if (profissionalOperaComoEmpresaHospedagem(roleBase, ehAnfitriao, modoEfetivo, empresaHospedagemId, empresaHospedagemLiberada)) {
      return 'empresa'
    }
    return roleBase === 'admin' ? 'admin' : roleBase
  })()
  const isEmpresaBar = roleParaBarra === 'empresa'
  const perfilBarraCache =
    authUserId && lerPerfilBarraCache()?.userId === authUserId ? lerPerfilBarraCache() : null
  const empresaIdBar =
    isEmpresaBar && modoAtivo && contextoEmpresaId
      ? contextoEmpresaId
      : isEmpresaBar && profissionalOperaComoEmpresaHospedagem(userRole, ehAnfitriao, modoEfetivo, empresaHospedagemId, empresaHospedagemLiberada)
        ? empresaHospedagemId ?? empresaId ?? perfilBarraCache?.empresaHospedagemId ?? null
        : userRole === 'empresa'
          ? empresaId ?? perfilBarraCache?.empresaId ?? null
          : null

  /** Turistas: Favoritos no 2.º slot; demais perfis logados ou simulados: Canal. */
  const segundoEhFavoritosNaBarra = roleParaBarra === 'turista'
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

  const fotoExibidaBarra = (() => {
    const fotoProfSocial =
      perfilBarraCache?.fotoProfSocialUrl ??
      fotoPerfilBarra ??
      (userRole === 'profissional' ? perfilBarraCache?.fotoUrl : null) ??
      fotoPerfilCache
    const operaEmpresa = profissionalOperaComoEmpresaHospedagem(
      userRole,
      ehAnfitriao,
      modoEfetivo,
      empresaHospedagemId,
      empresaHospedagemLiberada,
    )
    if (operaEmpresa) {
      return empresaHospedagem?.foto_url ?? perfilBarraCache?.empresaFotoUrl ?? fotoProfSocial
    }
    if (userRole === 'empresa' || isEmpresaBar) {
      return fotoPerfilBarra ?? perfilBarraCache?.fotoUrl ?? fotoPerfilCache
    }
    return fotoProfSocial
  })()

  const getQuintoIcone = () => {
    const active = isQuintoActive()

    if (fotoExibidaBarra) {
      return (
        <div
          className={`relative h-6 w-6 overflow-hidden rounded-md ${active ? 'ring-2 ring-[#0097b2] ring-offset-2' : ''}`}
        >
          <AvatarImage src={fotoExibidaBarra} alt="Perfil" fill className="object-cover" sizes="24px" />
        </div>
      )
    }

    if (isEmpresaBar) {
      return <Building2 size={24} className={active ? 'text-[#0097b2]' : 'text-gray-400'} aria-hidden />
    }
    return <User size={24} className={active ? 'text-[#0097b2]' : 'text-gray-400'} aria-hidden />
  }

  const antesDeNavegar = () => {
    void resumirSessaoAposIdle()
  }

  return (
    <div
      ref={rootRef}
      className="fixed bottom-0 left-1/2 z-50 w-full max-w-[var(--app-column)] border-t border-gray-200 bg-white pb-safe shadow-lg"
      style={{ transform: 'translate3d(-50%, 0, 0)' }}
    >
      <div className="flex items-center justify-around py-2">
        <Link
          href="/guia"
          onPointerDown={antesDeNavegar}
          className="flex flex-col items-center p-2"
          aria-label={t('home')}
        >
          <Home size={24} className={matchPath('/guia', pathname) ? 'text-[#0097b2]' : 'text-gray-400'} />
        </Link>

        {segundoEhFavoritosNaBarra ? (
          <Link
            href="/favoritos"
            onPointerDown={antesDeNavegar}
            className="flex flex-col items-center p-2"
            aria-label={t('favorites')}
          >
            <Star
              size={24}
              className={matchPath('/favoritos', pathname) ? 'text-[#0097b2]' : 'text-gray-400'}
              aria-hidden
            />
          </Link>
        ) : (
          <Link
            href="/canal"
            onPointerDown={antesDeNavegar}
            className="relative flex flex-col items-center p-2"
            aria-label={t('channel')}
          >
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

        {isEmpresaBar ? (
          <Link
            href="/dashboard/empresa"
            onPointerDown={antesDeNavegar}
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
            onPointerDown={antesDeNavegar}
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

        <Link
          href="/atividades"
          onPointerDown={antesDeNavegar}
          className="relative flex flex-col items-center p-2"
          aria-label={t('activities')}
        >
          <Heart size={24} className={isQuartoActive() ? 'text-[#0097b2]' : 'text-gray-400'} aria-hidden />
          {naoLidasAtividades > 0 ? (
            <span className="absolute right-0 top-0 flex min-h-[14px] min-w-[14px] max-w-[2rem] translate-x-1/4 -translate-y-1/4 items-center justify-center rounded-full bg-[#F44336] px-0.5 text-[9px] font-bold leading-none text-white tabular-nums">
              {naoLidasAtividades > 99 ? '99+' : naoLidasAtividades}
            </span>
          ) : null}
        </Link>

        <Link
          href={getQuintoHref()}
          onPointerDown={antesDeNavegar}
          prefetch={false}
          className="flex flex-col items-center p-2"
          aria-label={isEmpresaBar ? t('companyGuia') : t('profile')}
        >
          {getQuintoIcone()}
        </Link>
      </div>

      <PopupAvisoBloqueioConta
        aberto={avisoFeedAberto}
        onFechar={fecharAvisoBloqueioFeed}
        titulo={tituloBloqueioFeed}
        mensagem={mensagemBloqueioFeed}
      />
    </div>
  )
}
