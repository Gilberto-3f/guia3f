'use client'

import { useTranslations } from 'next-intl'
import BandeiraPais from '@/components/BandeiraPais'
import { SEGMENTOS_EMPRESA_SLUG, TITULO_SLUG_GUIA, type SegmentoEmpresaSlug } from '@/lib/segmentosEmpresaGuia'
import { FILTRO_CIDADE_OPCOES } from '@/lib/mobilidadeMapaEmpresas'
import type { PaisGuiaFiltro } from '@/lib/segmentosEmpresaGuia'

type Props = {
  cidadePais: PaisGuiaFiltro | null
  onCidadePais: (p: PaisGuiaFiltro | null) => void
  segmentos: SegmentoEmpresaSlug[]
  onSegmentos: (s: SegmentoEmpresaSlug[]) => void
}

export default function FiltrosMapaMobilidade({
  cidadePais,
  onCidadePais,
  segmentos,
  onSegmentos,
}: Props) {
  const t = useTranslations('Mobilidade')

  const toggleSegmento = (slug: SegmentoEmpresaSlug) => {
    if (segmentos.includes(slug)) {
      onSegmentos(segmentos.filter((s) => s !== slug))
    } else {
      onSegmentos([...segmentos, slug])
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <span className="w-full text-[10px] font-semibold uppercase tracking-wide text-white/90">
          {t('filtroCidade')}
        </span>
        <button
          type="button"
          onClick={() => onCidadePais(null)}
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            cidadePais == null ? 'bg-white text-[#0097b2]' : 'bg-white/20 text-white'
          }`}
        >
          {t('filtroTodas')}
        </button>
        {FILTRO_CIDADE_OPCOES.map((opt) => (
          <button
            key={opt.pais}
            type="button"
            onClick={() => onCidadePais(cidadePais === opt.pais ? null : opt.pais)}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
              cidadePais === opt.pais ? 'bg-white text-[#0097b2]' : 'bg-white/20 text-white'
            }`}
          >
            <BandeiraPais codigo={opt.pais === 'br' ? 'BR' : opt.pais === 'py' ? 'PY' : 'AR'} className="text-sm" />
            {opt.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className="w-full text-[10px] font-semibold uppercase tracking-wide text-white/90">
          {t('filtroAtrativos')}
        </span>
        {(SEGMENTOS_EMPRESA_SLUG as readonly SegmentoEmpresaSlug[]).map((slug) => {
          const ativo = segmentos.length === 0 || segmentos.includes(slug)
          const selecionado = segmentos.includes(slug)
          return (
            <button
              key={slug}
              type="button"
              onClick={() => toggleSegmento(slug)}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                selecionado
                  ? 'bg-white text-[#0097b2]'
                  : ativo && segmentos.length === 0
                    ? 'bg-white/20 text-white'
                    : 'bg-white/10 text-white/70'
              }`}
            >
              {TITULO_SLUG_GUIA[slug] ?? slug}
            </button>
          )
        })}
      </div>
    </div>
  )
}
