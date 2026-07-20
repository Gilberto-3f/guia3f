'use client'

import { useCallback, useEffect, useState } from 'react'
import { Link, usePathname } from '@/i18n/navigation'
import { signOutCurrentDevice } from '@/lib/authCookieSync'
import { useDashboardEmpresa } from '@/app/[locale]/(app-shell)/dashboard/empresa/hooks/useDashboardEmpresa'
import { useEmpresaServicosPlano } from '@/hooks/useEmpresaServicosPlano'
import type { MenuEmpresaId } from '@/lib/planosEmpresaServicosGate'
import { supabase } from '@/lib/supabase'
import { contarNaoLidasChatAdmMembro } from '@/lib/ecossistemaConversas'
import { GUIA_CHAT_ADM_BADGE_EVENT } from '@/lib/chat-adm-badge-events'

interface MenuItem {
  id: MenuEmpresaId
  icon: string
  label: string
  href: string
}

const MENU_ITEMS: MenuItem[] = [
  { id: 'feed-stories', icon: '📱', label: 'Rede Social', href: '/empresa/menu/feed-stories' },
  { id: 'cadastrar-comissao', icon: '💰', label: 'Cadastrar Comissão', href: '/empresa/menu/cadastrar-comissao' },
  { id: 'botao-dinamico', icon: '🔘', label: 'Botão Dinâmico', href: '/empresa/menu/botao-dinamico' },
  { id: 'auxiliar-adm', icon: '🛡️', label: 'Auxiliar ADM', href: '/empresa/menu/auxiliar-adm' },
  { id: 'publicidade', icon: '📢', label: 'Publicidade', href: '/empresa/menu/publicidade' },
  { id: 'chat-adm', icon: '💬', label: 'Chat ADM', href: '/chat-adm' },
  { id: 'denuncias', icon: '⚠️', label: 'Denúncias', href: '/empresa/menu/denuncias' },
]

function pathMatchesHref(pathname: string, href: string) {
  return pathname === href || pathname.endsWith(href)
}

export default function MenuLateralEmpresa({ aberto, onClose }: { aberto: boolean; onClose: () => void }) {
  const pathname = usePathname()
  const { dados } = useDashboardEmpresa()
  const { menuVisivel } = useEmpresaServicosPlano(dados?.plano, dados?.id)
  const [chatAdmNaoLido, setChatAdmNaoLido] = useState(0)

  const usuarioId = dados?.usuario_id ?? null

  const refreshChatAdmBadge = useCallback(async () => {
    if (!usuarioId) {
      setChatAdmNaoLido(0)
      return
    }
    try {
      const n = await contarNaoLidasChatAdmMembro(supabase, usuarioId)
      setChatAdmNaoLido(n)
    } catch {
      setChatAdmNaoLido(0)
    }
  }, [usuarioId])

  useEffect(() => {
    if (!usuarioId) {
      setChatAdmNaoLido(0)
      return
    }
    let cancelled = false
    let debounceId: ReturnType<typeof setTimeout> | null = null

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
      .channel(`menu-empresa-chat-adm-${usuarioId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ecossistema_conversa_leitura',
          filter: `usuario_id=eq.${usuarioId}`,
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
          filter: `usuario_id=eq.${usuarioId}`,
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
  }, [usuarioId, refreshChatAdmBadge])

  useEffect(() => {
    if (aberto) void refreshChatAdmBadge()
  }, [aberto, refreshChatAdmBadge])

  const itensVisiveis = MENU_ITEMS.filter((item) => {
    return menuVisivel(item.id)
  })

  const handleLogout = async () => {
    await signOutCurrentDevice()
    window.location.href = '/'
  }

  return (
    <>
      {aberto ? <button type="button" className="fixed inset-0 z-[190] bg-black/50" onClick={onClose} aria-label="Fechar menu" /> : null}

      <div
        className={`fixed right-0 top-0 z-[200] h-full w-full transform bg-white shadow-2xl transition-transform duration-300 ${
          aberto ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="relative shrink-0 bg-gradient-to-r from-[#0097b2] to-[#007a91] pt-safe">
          <div className="relative h-28 p-4">
            <button type="button" onClick={onClose} className="absolute right-4 top-4 text-xl text-white" aria-label="Fechar">
              ✕
            </button>
            <div className="absolute -bottom-10 left-4">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-gray-200 text-2xl">
                🏢
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 border-b px-4 pb-4">
          <h3 className="text-lg font-bold text-[#001f3f]">{dados?.nome ?? 'Empresa'}</h3>
          <p className="text-sm text-gray-500">@{dados?.username ?? 'empresa'}</p>
          <span className="mt-1 inline-block rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-800">🏢 Empresa</span>
        </div>

        <div className="max-h-[calc(100vh-190px)] overflow-y-auto px-2 py-4">
          {itensVisiveis.map((item) => {
            const active = pathMatchesHref(pathname, item.href)
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => {
                  // Só fecha se já estiver na rota. Ao navegar, o drawer cobre a página
                  // até o unmount — evita flash da página anterior.
                  if (active) onClose()
                }}
                className={`mb-1 flex items-center rounded-lg p-3 transition-colors ${
                  active ? 'bg-gray-100 text-[#0097b2]' : 'text-gray-800 hover:bg-gray-100'
                }`}
              >
                <span className="mr-3 text-xl" aria-hidden>
                  {item.icon}
                </span>
                <span className="min-w-0 flex-1">{item.label}</span>
                {item.id === 'chat-adm' && chatAdmNaoLido > 0 ? (
                  <span className="rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white">
                    {chatAdmNaoLido}
                  </span>
                ) : null}
              </Link>
            )
          })}

          <div className="my-2 h-px bg-gray-200" />

          <button type="button" onClick={() => void handleLogout()} className="flex w-full items-center rounded-lg p-3 text-red-600 hover:bg-red-50">
            <span className="mr-3 text-xl" aria-hidden>
              🚪
            </span>
            <span className="flex-1 text-left">Sair</span>
          </button>
        </div>
      </div>
    </>
  )
}

