'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from '@/i18n/navigation'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'
import { useTranslations } from 'next-intl'
import { Car, MapPin } from 'lucide-react'
import PublicidadeHome from '@/components/PublicidadeHome'
import GradeFiltros from '@/components/GradeFiltros'
import PopupFavoritos from '@/components/PopupFavoritos'
import { supabase } from '@/lib/supabase'

function abaGuiaCls(ativo: boolean) {
  return `flex min-w-0 flex-1 items-center justify-center gap-2 border-b-[3px] py-3 text-center text-sm font-semibold tracking-wide transition-colors sm:text-base ${
    ativo
      ? 'border-[#0097b2] text-[#0097b2]'
      : 'border-transparent text-gray-500'
  }`
}

export default function GuiaPage() {
  const tMobilidade = useTranslations('Mobilidade')
  const tGuia = useTranslations('Guia')
  const router = useRouter()
  const { podeInteragir, notificarSomenteLeitura, modoAtivo, perfilSimulado, contextoEmpresaId } = useModoApresentacao()
  const [abaAtiva, setAbaAtiva] = useState<'guia' | 'mobilidade'>('guia')
  const [popupFavoritosAberto, setPopupFavoritosAberto] = useState(false)
  const [podeVerPreviewEmpresa, setPodeVerPreviewEmpresa] = useState(false)

  useEffect(() => {
    let ativo = true

    const boot = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const uid = session?.user?.id ?? null
      if (!uid) {
        if (ativo) setPodeVerPreviewEmpresa(false)
        return
      }
      const { data } = await supabase.from('usuarios').select('role, admin_level').eq('id', uid).maybeSingle()
      const role = data?.role != null ? String(data.role) : null
      const adminLevel = typeof data?.admin_level === 'number' ? data.admin_level : 0
      const adminGeral = role === 'admin' && adminLevel === 1
      const simEmpresa = modoAtivo && perfilSimulado?.tipo === 'empresa' && Boolean(contextoEmpresaId)
      if (ativo) setPodeVerPreviewEmpresa(adminGeral && simEmpresa)
    }

    void boot()
    return () => {
      ativo = false
    }
  }, [contextoEmpresaId, modoAtivo, perfilSimulado?.tipo])

  const handleFiltroClick = (filtroId: string) => {
    if (filtroId === 'favoritos' && !podeInteragir) {
      notificarSomenteLeitura()
      return
    }
    if (filtroId === 'favoritos') {
      setPopupFavoritosAberto(true)
    } else if (filtroId === 'compras') {
      router.push('/guia/compras')
    } else {
      router.push(`/guia/${filtroId}`)
    }
  }

  return (
    <div className="flex h-[calc(100dvh-5rem)] flex-col overflow-hidden bg-gray-50">
      <header className="shrink-0">
        <div className="flex justify-center bg-[#0097b2] py-2">
          <Image src="/logo.png" alt="Guia 3F" width={120} height={40} priority className="h-auto w-auto object-contain" />
        </div>

        <div className="flex w-full border-b border-gray-200 bg-white">
          <button type="button" onClick={() => setAbaAtiva('guia')} className={abaGuiaCls(abaAtiva === 'guia')}>
            <MapPin className="h-5 w-5 shrink-0 sm:h-[1.35rem] sm:w-[1.35rem]" aria-hidden strokeWidth={2} />
            <span>{tGuia('tabGuia')}</span>
          </button>
          <button
            type="button"
            onClick={() => setAbaAtiva('mobilidade')}
            className={abaGuiaCls(abaAtiva === 'mobilidade')}
          >
            <Car className="h-5 w-5 shrink-0 sm:h-[1.35rem] sm:w-[1.35rem]" aria-hidden strokeWidth={2} />
            <span>{tGuia('tabMobilidade')}</span>
          </button>
        </div>
      </header>

      {abaAtiva === 'guia' ? (
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {podeVerPreviewEmpresa ? (
              <div className="px-4 pt-4">
                <button
                  type="button"
                  onClick={() => router.push('/modo-apresentacao/empresa')}
                  className="w-full rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm font-semibold text-amber-900 hover:bg-amber-100"
                >
                  Preview da página da empresa (Modo Apresentação)
                  <span className="mt-1 block text-xs font-medium text-amber-800/80">
                    Somente ADM • edições salvas apenas para você
                  </span>
                </button>
              </div>
            ) : null}
            <GradeFiltros onFiltroClick={handleFiltroClick} />
            <PublicidadeHome />
          </div>
        </main>
      ) : (
        <main className="flex min-h-0 flex-1 flex-col items-center justify-start overflow-y-auto bg-gray-50 px-4 py-8 text-center">
          <p className="text-lg font-medium text-gray-600">{tMobilidade('comingSoon')}</p>
          <p className="mt-2 max-w-md text-sm text-gray-500">{tMobilidade('description')}</p>
        </main>
      )}

      <PopupFavoritos isOpen={popupFavoritosAberto} onClose={() => setPopupFavoritosAberto(false)} />
    </div>
  )
}
