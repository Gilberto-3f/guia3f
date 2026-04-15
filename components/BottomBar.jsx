'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
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

function matchPath(path, pathname) {
  if (!pathname) return false
  if (path === '/guia' && pathname === '/guia') return true
  if (path === '/canal' && pathname === '/canal') return true
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
  const [userRole, setUserRole] = useState(/** @type {string | null} */ (null))
  const [empresaId, setEmpresaId] = useState(/** @type {string | null} */ (null))
  const [authUserId, setAuthUserId] = useState(/** @type {string | null} */ (null))
  const [fotoPerfil, setFotoPerfil] = useState(/** @type {string | null} */ (null))
  const [naoLidasAtividades, setNaoLidasAtividades] = useState(0)

  useEffect(() => {
    let ativo = true

    const getUserData = async () => {
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
        }
        return
      }

      const uid = session.user.id
      if (ativo) setAuthUserId(uid)

      const { data: userData } = await supabase.from('usuarios').select('role').eq('id', uid).maybeSingle()
      const role = userData?.role ?? null
      if (ativo) setUserRole(role)

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
          if (!cErr && typeof count === 'number') {
            setNaoLidasAtividades(count)
          } else if (ativo) {
            setNaoLidasAtividades(0)
          }
        }
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

  const isFeedPage = pathname === '/feed'

  const getTerceiroHref = () => {
    if (isFeedPage) return '/feed/criar'
    return '/feed'
  }

  const terceiroActive = isFeedPage || pathname === '/feed/criar'

  const getQuartoHref = () => {
    if (userRole === 'empresa') return '/dashboard/empresa'
    return '/atividades'
  }

  const isQuartoActive = () => {
    if (userRole === 'empresa') return pathname != null && pathname.startsWith('/dashboard/empresa')
    return isBarraAtividades(pathname)
  }

  const getQuintoHref = () => {
    if (userRole === 'empresa') {
      return empresaId ? `/empresa/${empresaId}` : '/dashboard/empresa'
    }
    if (authUserId && (userRole === 'turista' || userRole === 'profissional' || userRole === 'admin'))
      return `/perfil/${authUserId}`
    return '/perfil'
  }

  const isQuintoActive = () => {
    if (userRole === 'empresa') {
      return Boolean(empresaId && pathname != null && pathname === `/empresa/${empresaId}`)
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

    if (userRole === 'empresa') {
      return <Building2 size={24} className={active ? 'text-[#0097b2]' : 'text-gray-400'} aria-hidden />
    }
    return <User size={24} className={active ? 'text-[#0097b2]' : 'text-gray-400'} aria-hidden />
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white shadow-lg">
      <div className="flex items-center justify-around py-2">
        <Link href="/guia" className="flex flex-col items-center p-2" aria-label={t('home')}>
          <Home size={24} className={matchPath('/guia', pathname) ? 'text-[#0097b2]' : 'text-gray-400'} />
        </Link>

        <Link href="/canal" className="flex flex-col items-center p-2" aria-label={t('channel')}>
          <MessageCircle
            size={24}
            className={matchPath('/canal', pathname) ? 'text-[#0097b2]' : 'text-gray-400'}
            aria-hidden
          />
        </Link>

        <Link
          href={getTerceiroHref()}
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
          aria-label={userRole === 'empresa' ? t('dashboard') : t('activities')}
        >
          {userRole === 'empresa' ? (
            <LayoutDashboard
              size={24}
              className={isQuartoActive() ? 'text-[#0097b2]' : 'text-gray-400'}
              aria-hidden
            />
          ) : (
            <>
              <Heart size={24} className={isQuartoActive() ? 'text-[#0097b2]' : 'text-gray-400'} aria-hidden />
              {naoLidasAtividades > 0 ? (
                <span className="absolute -right-0 -top-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F44336] px-1 text-[10px] font-bold text-white">
                  {naoLidasAtividades > 99 ? '99+' : naoLidasAtividades}
                </span>
              ) : null}
            </>
          )}
        </Link>

        <Link
          href={getQuintoHref()}
          className="flex flex-col items-center p-2"
          aria-label={userRole === 'empresa' ? t('companyGuia') : t('profile')}
        >
          {getQuintoIcone()}
        </Link>
      </div>
    </div>
  )
}
