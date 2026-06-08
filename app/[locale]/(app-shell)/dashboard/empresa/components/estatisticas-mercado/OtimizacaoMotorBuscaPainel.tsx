'use client'

import { useMemo } from 'react'
import type { TopTermosSegmentoGuia } from '@/lib/buscasGuia'
import { corSegmentoMercado, normalizarSegmentoMercado, type SegmentoMercado } from '@/lib/segmentosMercado'

import SubsecaoMercado from './SubsecaoMercado'
import GraficoBarrasVertical from './GraficoBarrasVertical'

interface Props {
  topTermos: TopTermosSegmentoGuia[]
}

const SEGMENTOS_SEO = [
  { slug: 'gastronomia', titulo: 'Gastronomia' },
  { slug: 'passeios', titulo: 'Atrativos' },
  { slug: 'lojas', titulo: 'Lojas' },
  { slug: 'hospedagem', titulo: 'Hospedagem' },
  { slug: 'servicos_locais', titulo: 'Serviços Locais' },
] as const

function segmentoGuiaParaMercado(slug: string): SegmentoMercado | null {
  if (slug === 'passeios') return 'atrativos'
  if (slug === 'servicos_locais') return 'servicos'
  return normalizarSegmentoMercado(slug)
}

function barrasDoSegmento(topTermos: TopTermosSegmentoGuia[], slug: string) {
  const hit = topTermos.find((t) => t.segmento_guia === slug)
  const termos = hit?.termos ?? []
  const segMercado = segmentoGuiaParaMercado(slug)
  const cor = segMercado ? corSegmentoMercado(segMercado) : '#0097b2'
  return termos.slice(0, 10).map((t) => ({
    label: t.termo,
    valor: t.total,
    cor,
  }))
}

export default function OtimizacaoMotorBuscaPainel({ topTermos }: Props) {
  const barrasPorSegmento = useMemo(
    () =>
      Object.fromEntries(
        SEGMENTOS_SEO.map(({ slug }) => [slug, barrasDoSegmento(topTermos, slug)]),
      ) as Record<string, { label: string; valor: number; cor: string }[]>,
    [topTermos],
  )

  return (
    <div className="space-y-3">
      <p className="text-center text-xs font-medium text-gray-600 sm:text-sm">
        Termos mais buscados (por segmento)
      </p>

      {SEGMENTOS_SEO.map(({ slug, titulo }) => {
        const barras = barrasPorSegmento[slug] ?? []
        return (
          <SubsecaoMercado
            key={slug}
            id={`seo-${slug}`}
            titulo={titulo}
            subtitulo="Top 10 palavras-chave pesquisadas no motor de busca do guia"
          >
            {barras.length === 0 ? (
              <div className="flex min-h-[10rem] items-center justify-center rounded-lg border border-dashed border-gray-200 bg-white px-4 text-center text-sm text-gray-500">
                Nenhuma busca registrada neste segmento no período selecionado.
              </div>
            ) : (
              <GraficoBarrasVertical dados={barras} semTitulo embed />
            )}
            <p className="text-center text-[11px] text-gray-400">
              Dados agregados e anônimos · apenas buscas no segmento correspondente do guia
            </p>
          </SubsecaoMercado>
        )
      })}
    </div>
  )
}
