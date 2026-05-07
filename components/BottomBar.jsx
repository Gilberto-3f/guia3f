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
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'

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
 * `lida_por`: JSONB [{ usuario_id, lida_em }, …]
 * @param {unknown} lidaPorRaw
 * @param {string} userId
 */
function usuarioMarcouLeituraNaMensagem(lidaPorRaw, userId) {
  if (!userId) return false
  const arr = Array.isArray(lidaPorRaw) ? lidaPorRaw : []
  return arr.some((entry) => {
    if (!entry || typeof entry !== 'object') return false
    const id = /** @type {{ usuario_id?: string }} */ (entry).usuario_id
    return id != null && String(id) === String(userId)
  })
}

/**
 * Mensagens de outros utilizadores em canais acessíveis (RLS), ainda não lidas pelo utilizador.
 * @param {string} userId
 */
async function contarMensagensNaoLidasCanais(userId) {
  if (!userId) return 0
  const desde = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('mensagens_canal')
    .select('lida_por')
    .neq('remetente_id', userId)
    .gte('created_at', desde)
    .limit(2500)
  if (error || !data) return 0
  let n = 0
  for (const row of data) {
    if (!usuarioMarcouLeituraNaMensagem(row.lida_por, userId)) n += 1
  }
  return n
}

function matchPath(path, pathname) {
  if (!pathname) return false
  if (path === '/guia' && pathname === '/guia') return true
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

export default function BottomBar() {
  const t = useTranslations('BottomBar')
  const pathname = usePathname()
  const { modoAtivo, perfilSimulado, contextoEmpresaId, podeInteragir, notificarSomenteLeitura } = useModoApresentacao()
  const rootRef = useRef(/** @type {HTMLDivElement | null} */ (null))
  const [userRole, setUserRole] = useState(/** @type {string | null} */ (null))
  const [empresaId, setEmpresaId] = useState(/** @type {string | null} */ (null))
  const [authUserId, setAuthUserId] = useState(/** @type {string | null} */ (null))
  const [fotoPerfil, setFotoPerfil] = useState(/** @type {string | null} */ (null))
  const [naoLidasAtividades, setNaoLidasAtividades] = useState(0)
  const [naoLidasCanais, setNaoLidasCanais] = useState(0)
  /** Primeira carga da sessão/role na barra; até lá o 5.º ícone não navega (evita `/perfil` → empresa). */
  const [barSessaoPronta, setBarSessaoPronta] = useState(false)

  useEffect(() => {
    let ativo = true

    const getUserData = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (!session?.user?.id) {
          if (ativo) {
            setUserRole(null)
            setEmpresaId(null)
            setAuthUserId(null)
            setFotoPerfil(null)
            setNaoLidasAtividades(0)
            setNaoLidasCanais(0)
          }
          return
        }

        const uid = session.user.id

        const { data: userData } = await supabase.from('usuarios').select('role').eq('id', uid).maybeSingle()
        const role = userData?.role ?? null
        /** `authUserId` só depois do `role` — evita um frame em que o 5.º ícone aponta para `/perfil` e redireciona empresa para mensagem errada. */
        if (ativo) {
          setUserRole(role)
          setAuthUserId(uid)
        }

        if (role === 'empresa') {
          const { data: empresa } = await supabase
            .from('empresas')
            .select('id, foto_url')
            .eq('usuario_id', uid)
            .maybeSingle()

          if (ativo) {
            setEmpresaId(empresa?.id ?? null)
            setFotoPerfil(empresa?.foto_url != null ? String(empresa.foto_url) : null)
            setNaoLidasAtividades(0)
          }
        } else {
          if (ativo) setEmpresaId(null)
          if (role === 'turista') {
            const { data: perfil } = await supabase
              .from('turistas')
              .select('foto_perfil_url, foto_url')
              .eq('usuario_id', uid)
              .maybeSingle()
            if (ativo)
              setFotoPerfil(
                perfil?.foto_perfil_url != null
                  ? String(perfil.foto_perfil_url)
                  : perfil?.foto_url != null
                    ? String(perfil.foto_url)
                    : null
              )
          } else if (role === 'profissional') {
            const { data: perfil } = await supabase
              .from('profissionais')
              .select('foto_perfil_url, foto_url')
              .eq('usuario_id', uid)
              .maybeSingle()
            if (ativo)
              setFotoPerfil(
                perfil?.foto_perfil_url != null
                  ? String(perfil.foto_perfil_url)
                  : perfil?.foto_url != null
                    ? String(perfil.foto_url)
                    : null
              )
          } else if (role === 'admin') {
            const [profRes, turRes] = await Promise.all([
              supabase.from('profissionais').select('foto_perfil_url, foto_url').eq('usuario_id', uid).maybeSingle(),
              supabase.from('turistas').select('foto_perfil_url, foto_url').eq('usuario_id', uid).maybeSingle(),
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
          } else if (ativo) {
            setFotoPerfil(null)
          }

          if (ativo && role !== 'empresa') {
            const { count, error: cErr } = await supabase
              .from('atividades')
              .select('*', { count: 'exact', head: true })
              .eq('usuario_id', uid)
              .eq('lida', false)
              .neq('tipo', 'avaliou')
              .neq('tipo', 'seguiu_empresa')
            if (!cErr && typeof count === 'number') {
              setNaoLidasAtividades(count)
            } else if (ativo) {
              setNaoLidasAtividades(0)
            }
          }
        }
      } finally {
        if (ativo) setBarSessaoPronta(true)
      }
    }

    void getUserData()
    const onPerfilAtualizado = () => {
      void getUserData()
    }
    window.addEventListener('perfil-atualizado', onPerfilAtualizado)
    return () => {
      ativo = false
      window.removeEventListener('perfil-atualizado', onPerfilAtualizado)
    }
  }, [pathname])

  useEffect(() => {
    if (!authUserId) {
      setNaoLidasCanais(0)
      return
    }
    let cancelled = false
    const refresh = async () => {
      const n = await contarMensagensNaoLidasCanais(authUserId)
      if (!cancelled) setNaoLidasCanais(n)
    }
    void refresh()
    const channel = supabase
      .channel(`bottom-bar-mensagens-canal-${authUserId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mensagens_canal' }, () => {
        void refresh()
      })
      .subscribe()
    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [authUserId, pathname])

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

  const getTerceiroHref = () => {
    if (isFeedPage) return '/feed/criar'
    return '/feed'
  }

  const terceiroActive = isFeedPage || pathname === '/feed/criar'

  const getQuartoHref = () => {
    if (isEmpresaBar) return '/dashboard/empresa'
    return '/atividades'
  }

  const isQuartoActive = () => {
    if (isEmpresaBar) return pathname != null && pathname.startsWith('/dashboard/empresa')
    return isBarraAtividades(pathname)
  }

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
        <Link href="/guia" className="flex flex-col items-center p-2" aria-label={t('home')}>
          <Home size={24} className={matchPath('/guia', pathname) ? 'text-[#0097b2]' : 'text-gray-400'} />
        </Link>

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

        <Link
          href={getTerceiroHref()}
          onClick={(e) => {
            if (!podeInteragir && isFeedPage) {
              e.preventDefault()
              notificarSomenteLeitura()
            }
          }}
          className={`flex flex-col items-center ${isFeedPage ? 'p-1' : 'p-2'}`}
          aria-label={isFeedPage ? t('newPost') : t('feed')}
        >
          {isFeedPage ? (
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#0097b2] shadow-lg">
              <Plus className="h-6 w-6 text-white" strokeWidth={2.5} aria-hidden />
            </span>
          ) : (
            <span className={terceiroActive ? 'text-[#0097b2]' : 'text-gray-400'}>
              <Menu size={24} aria-hidden />
            </span>
          )}
        </Link>

        <Link
          href={getQuartoHref()}
          className="relative flex flex-col items-center p-2"
          aria-label={isEmpresaBar ? t('dashboard') : t('activities')}
        >
          {isEmpresaBar ? (
            <LayoutDashboard
              size={24}
              className={isQuartoActive() ? 'text-[#0097b2]' : 'text-gray-400'}
              aria-hidden
            />
          ) : (
            <>
              <Heart size={24} className={isQuartoActive() ? 'text-[#0097b2]' : 'text-gray-400'} aria-hidden />
              {!isEmpresaBar && naoLidasAtividades > 0 ? (
                <span className="absolute right-0 top-0 flex min-h-[14px] min-w-[14px] max-w-[2rem] translate-x-1/4 -translate-y-1/4 items-center justify-center rounded-full bg-[#F44336] px-0.5 text-[9px] font-bold leading-none text-white tabular-nums">
                  {naoLidasAtividades > 99 ? '99+' : naoLidasAtividades}
                </span>
              ) : null}
            </>
          )}
        </Link>

        <Link
          href={getQuintoHref()}
          prefetch={false}
          onClick={(e) => {
            if (!barSessaoPronta) e.preventDefault()
          }}
          className={`flex flex-col items-center p-2 ${!barSessaoPronta ? 'cursor-wait opacity-60' : ''}`}
          aria-busy={!barSessaoPronta}
          aria-label={isEmpresaBar ? t('companyGuia') : t('profile')}
        >
          {getQuintoIcone()}
        </Link>
      </div>
    </div>
  )
}
