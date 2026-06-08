'use client'

import { useMemo } from 'react'
import { corSegmentoMercado, normalizarSegmentoMercado, paraGraficoPizza } from '@/lib/segmentosMercado'
import type { AnaliseMercadoDados } from '@/lib/estatisticasMercadoAnalise'

import SubsecaoMercado from './SubsecaoMercado'
import GraficoPizza from './GraficoPizza'
import GraficoBarrasVertical from './GraficoBarrasVertical'
import GraficoComissaoSegmento from './GraficoComissaoSegmento'

interface Props {
  analise: AnaliseMercadoDados
  categoriaEmpresa: string
}

export default function AnaliseMercadoPainel({ analise, categoriaEmpresa }: Props) {
  const segmentoEmpresa = normalizarSegmentoMercado(categoriaEmpresa)

  const pizzaVisibilidade = useMemo(
    () => paraGraficoPizza(analise.visibilidade),
    [analise.visibilidade],
  )
  const pizzaEngajamento = useMemo(() => paraGraficoPizza(analise.engajamento), [analise.engajamento])

  const barrasRecomendados = useMemo(
    () =>
      analise.recomendados.map((item) => ({
        label: item.label,
        valor: item.total,
        cor: corSegmentoMercado(item.segmento),
      })),
    [analise.recomendados],
  )

  const barrasComissao = useMemo(
    () =>
      analise.comissao.map((item) => ({
        label: item.label,
        valor: item.media,
        quantidade: item.quantidade,
        segmento: item.segmento,
        cor: corSegmentoMercado(item.segmento),
      })),
    [analise.comissao],
  )

  return (
    <div className="space-y-6">
      <SubsecaoMercado
        titulo="Mais Procurados"
        subtitulo="Segmentos de maior procura pelo público"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <GraficoPizza
            dados={pizzaVisibilidade}
            titulo="Visibilidade"
            embed
            mostrarComZero
          />
          <GraficoPizza
            dados={pizzaEngajamento}
            titulo="Engajamento"
            embed
            mostrarComZero
          />
        </div>
        <p className="text-center text-[11px] leading-relaxed text-gray-400">
          Visibilidade: visitas nas páginas das empresas. Engajamento: curtidas, comentários, reposts, compartilhamentos, salvos e avaliações.
        </p>
      </SubsecaoMercado>

      <SubsecaoMercado
        titulo="Mais Recomendados"
        subtitulo="Segmentos mais recomendados por profissionais"
      >
        <GraficoBarrasVertical dados={barrasRecomendados} embed />
      </SubsecaoMercado>

      <SubsecaoMercado
        titulo="Média de Comissão"
        subtitulo="Média de comissão por segmento"
      >
        <GraficoComissaoSegmento
          dados={barrasComissao}
          mediaEmpresa={analise.comissaoEmpresa.media}
          segmentoEmpresa={segmentoEmpresa}
          embed
        />
      </SubsecaoMercado>
    </div>
  )
}
