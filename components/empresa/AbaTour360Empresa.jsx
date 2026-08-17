'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import TourPlayer from '@/components/empresa/TourPlayer'
import EditorTour360 from '@/components/empresa/EditorTour360'
import UploadFotos360Adm from '@/components/empresa/UploadFotos360Adm'
import { parseTourConfig, sincronizarTourComFotos } from '@/lib/pannellumTour'

/**
 * Aba do tour 360° — visitante abre o player em tela cheia; admin vê chevron EDIÇÃO ADM antes do tour.
 *
 * @param {{
 *   fotos360Url: string[]
 *   tourConfig?: import('@/lib/tour360Types').TourConfig | unknown
 *   modoAdministracao?: boolean
 *   empresaId?: string
 *   onAtualizado?: () => void
 *   onFechar?: () => void
 * }} props
 */
export default function AbaTour360Empresa({
  fotos360Url,
  tourConfig,
  modoAdministracao = false,
  empresaId = '',
  onAtualizado,
  onFechar,
}) {
  const urls = Array.isArray(fotos360Url) ? fotos360Url.filter((u) => typeof u === 'string' && u.trim()) : []
  const tourMerged = useMemo(
    () => sincronizarTourComFotos(urls, parseTourConfig(tourConfig)),
    [urls, tourConfig]
  )
  const [edicaoAdmAberta, setEdicaoAdmAberta] = useState(false)

  const painelEdicaoAdm =
    modoAdministracao && empresaId ? (
      <div className="mb-4 text-left">
        <button
          type="button"
          onClick={() => setEdicaoAdmAberta((v) => !v)}
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-[#0097b2]/30 bg-white px-3 py-2.5 text-left shadow-sm transition hover:bg-[#0097b2]/5"
          aria-expanded={edicaoAdmAberta}
        >
          <span className="text-xs font-bold uppercase tracking-wide text-[#001f3f]">EDIÇÃO ADM</span>
          {edicaoAdmAberta ? (
            <ChevronUp className="h-4 w-4 shrink-0 text-[#0097b2]" aria-hidden />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-[#0097b2]" aria-hidden />
          )}
        </button>
        {edicaoAdmAberta ? (
          <div className="mt-2 overflow-hidden rounded-lg border border-gray-200">
            <UploadFotos360Adm
              empresaId={empresaId}
              fotos360Atuais={urls}
              tourConfigAtual={tourMerged}
              onAtualizado={onAtualizado}
            />
            <EditorTour360
              empresaId={empresaId}
              fotos360Url={urls}
              tourConfig={tourMerged}
              onSalvo={onAtualizado}
            />
          </div>
        ) : null}
      </div>
    ) : null

  return (
    <TourPlayer
      fotos360Url={urls}
      tourConfig={tourMerged}
      autoOpen={!modoAdministracao}
      painelAntesIniciar={painelEdicaoAdm}
      onFechar={onFechar}
    />
  )
}
