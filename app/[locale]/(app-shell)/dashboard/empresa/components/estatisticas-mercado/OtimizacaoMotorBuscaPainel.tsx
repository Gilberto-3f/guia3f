'use client'

import { useMemo, useState } from 'react'
import type { TopTermosSegmentoGuia } from '@/lib/buscasGuia'
import { ROTULO_SEGMENTO_GUIA } from '@/lib/buscasGuia'
import { corSegmentoMercado, normalizarSegmentoMercado, type SegmentoMercado } from '@/lib/segmentosMercado'
import { categoriaDbParaSlug } from '@/lib/segmentosEmpresaGuia'

import SubsecaoMercado from './SubsecaoMercado'
import GraficoBarrasVertical from './GraficoBarrasVertical'
import FiltroSelectMercado from './FiltroSelectMercado'

interface Props {
  topTermos: TopTermosSegmentoGuia[]
  categoriaEmpresa: string
}

const SEGMENTOS_GUIA_ORDEM = ['gastronomia', 'passeios', 'lojas', 'hospedagem', 'servicos_locais'] as const

function segmentoGuiaParaMercado(slug: string): SegmentoMercado | null {
  if (slug === 'passeios') return 'atrativos'
  if (slug === 'servicos_locais') return 'servicos'
  return normalizarSegmentoMercado(slug)
}

export default function OtimizacaoMotorBuscaPainel({ topTermos, categoriaEmpresa }: Props) {
  const segmentoEmpresaSlug = categoriaDbParaSlug(categoriaEmpresa) || 'gastronomia'
  const [segmentoSelecionado, setSegmentoSelecionado] = useState<string>(segmentoEmpresaSlug)

  const opcoesSegmento = useMemo(
    () =>
      SEGMENTOS_GUIA_ORDEM.map((slug) => ({
        valor: slug,
        rotulo: ROTULO_SEGMENTO_GUIA[slug] ?? slug,
      })),
    [],
  )

  const termosSegmento = useMemo(() => {
    const hit = topTermos.find((t) => t.segmento_guia === segmentoSelecionado)
    return hit?.termos ?? []
  }, [segmentoSelecionado, topTermos])

  const barras = useMemo(() => {
    const segMercado = segmentoGuiaParaMercado(segmentoSelecionado)
    const cor = segMercado ? corSegmentoMercado(segMercado) : '#0097b2'
    return termosSegmento.slice(0, 10).map((t) => ({
      label: t.termo,
      valor: t.total,
      cor,
    }))
  }, [segmentoSelecionado, termosSegmento])

  return (
    <div className="space-y-4">
      <SubsecaoMercado
        titulo="Termos mais buscados"
        subtitulo="Top 10 palavras-chave pesquisadas no motor de busca do guia, por segmento"
      >
        <div className="mb-4 flex justify-center">
          <FiltroSelectMercado
            rotulo="Segmento"
            valor={segmentoSelecionado}
            opcoes={opcoesSegmento}
            onChange={setSegmentoSelecionado}
          />
        </div>

        {barras.length === 0 ? (
          <div className="flex min-h-[10rem] items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50/80 px-4 text-center text-sm text-gray-500">
            Nenhuma busca registrada neste segmento no período selecionado.
          </div>
        ) : (
          <GraficoBarrasVertical dados={barras} semTitulo embed />
        )}

        <p className="mt-2 text-center text-[11px] text-gray-400">
          Dados agregados e anônimos · apenas buscas no segmento correspondente do guia
        </p>
      </SubsecaoMercado>
    </div>
  )
}
