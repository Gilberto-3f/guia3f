'use client'

import { useState } from 'react'
import { Megaphone } from 'lucide-react'
import { useRouter } from '@/i18n/navigation'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import { supabase } from '@/lib/supabase'
import PopupRecomendar from '@/components/PopupRecomendar'

const COR_RECOMENDAR = '#00D443'

/**
 * @param {{
 *   empresa: import('@/lib/recomendarEmpresa').EmpresaRecomendacaoInfo
 *   segmentoGuiaSlug?: string | null
 * }} props
 */
export default function BotaoRecomendar({ empresa, segmentoGuiaSlug }) {
  const router = useRouter()
  const { perfilEhProfissional, loading: gateLoading } = useProfissionalGate()
  const [popupAberto, setPopupAberto] = useState(false)

  if (gateLoading || !perfilEhProfissional) return null

  const abrirPopup = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.user?.id) {
      router.push(`/login?next=${encodeURIComponent('/guia')}`)
      return
    }
    setPopupAberto(true)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void abrirPopup()}
        className="flex min-h-[3.25rem] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-center text-xs font-bold leading-tight text-white whitespace-normal transition-opacity hover:opacity-95 sm:text-sm"
        style={{ backgroundColor: COR_RECOMENDAR }}
      >
        <Megaphone size={20} className="shrink-0 text-white" aria-hidden />
        <span className="max-w-full leading-tight">RECOMENDAR</span>
      </button>

      <PopupRecomendar
        aberto={popupAberto}
        onFechar={() => setPopupAberto(false)}
        empresa={empresa}
        segmentoGuiaSlug={segmentoGuiaSlug}
      />
    </>
  )
}
