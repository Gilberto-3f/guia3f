'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOutCurrentDevice } from '@/lib/authCookieSync'
import { useDashboardEmpresa } from '@/app/[locale]/(app-shell)/dashboard/empresa/hooks/useDashboardEmpresa'
import { useEmpresaServicosPlano } from '@/hooks/useEmpresaServicosPlano'
import type { MenuEmpresaId } from '@/lib/planosEmpresaServicosGate'

interface MenuItem {
  id: MenuEmpresaId
  icon: string
  label: string
  href: string
}

const MENU_ITEMS: MenuItem[] = [
  { id: 'feed-stories', icon: '📱', label: 'Feed e Storys', href: '/empresa/menu/feed-stories' },
  { id: 'publicidade', icon: '📢', label: 'Publicidade', href: '/empresa/menu/publicidade' },
  { id: 'chat-adm', icon: '💬', label: 'Chat ADM', href: '/chat-adm' },
  { id: 'denuncias', icon: '⚠️', label: 'Denúncias', href: '/empresa/menu/denuncias' },
  { id: 'compras-paraguai', icon: '🛍️', label: 'Compras Paraguai', href: '/empresa/menu/compras-paraguai' },
]

export default function MenuLateralEmpresa({ aberto, onClose }: { aberto: boolean; onClose: () => void }) {
  const pathname = usePathname()
  const { dados } = useDashboardEmpresa()
  const { menuLiberado } = useEmpresaServicosPlano(dados?.plano, dados?.id)

  const itensVisiveis = MENU_ITEMS.filter((item) => menuLiberado(item.id))

  const handleLogout = async () => {
    await signOutCurrentDevice()
    window.location.href = '/'
  }

  return (
    <>
      {aberto ? <button type="button" className="fixed inset-0 z-[190] bg-black/50" onClick={onClose} aria-label="Fechar menu" /> : null}

      <div
        className={`fixed right-0 top-0 z-[200] h-full w-[min(100%,360px)] transform bg-white shadow-2xl transition-transform duration-300 ${
          aberto ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="relative h-28 bg-gradient-to-r from-[#0097b2] to-[#007a91] p-4">
          <button type="button" onClick={onClose} className="absolute right-4 top-4 text-xl text-white" aria-label="Fechar">
            ✕
          </button>
          <div className="absolute -bottom-10 left-4">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-gray-200 text-2xl">
              🏢
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
            const active = pathname === item.href
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={onClose}
                className={`mb-1 flex items-center rounded-lg p-3 transition-colors ${
                  active ? 'bg-gray-100 text-[#0097b2]' : 'text-gray-800 hover:bg-gray-100'
                }`}
              >
                <span className="mr-3 text-xl" aria-hidden>
                  {item.icon}
                </span>
                <span className="flex-1">{item.label}</span>
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

