'use client'

import { useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import { supabase } from '@/lib/supabase'
import IconWhatsApp from '@/components/IconWhatsApp'
import PopupRecomendar from '@/components/PopupRecomendar'

const COR_RECOMENDAR = '#00D443'

/**
 * @param {{
 *   empresa: import('@/lib/recomendarEmpresa').EmpresaRecomendacaoInfo
 *   segmentoGuiaSlug?: string | null
 *   rotulo?: string
 *   avisoGuia?: string | null
 * }} props
 */
export default function BotaoRecomendar({ empresa, segmentoGuiaSlug, rotulo = 'RECOMENDAR', avisoGuia = null }) {
  const router = useRouter()
  const { perfilEhProfissional, recursosProfissionaisLiberados, loading: gateLoading } =
    useProfissionalGate()
  const [popupAberto, setPopupAberto] = useState(false)

  if (!gateLoading && (!perfilEhProfissional || !recursosProfissionaisLiberados)) return null

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
        aria-busy={gateLoading}
      >
        <IconWhatsApp size={20} className="shrink-0 text-white" />
        <span className="max-w-full leading-tight">{rotulo}</span>
      </button>

      <PopupRecomendar
        aberto={popupAberto}
        onFechar={() => setPopupAberto(false)}
        empresa={empresa}
        segmentoGuiaSlug={segmentoGuiaSlug}
        avisoGuia={avisoGuia}
      />
    </>
  )
}
