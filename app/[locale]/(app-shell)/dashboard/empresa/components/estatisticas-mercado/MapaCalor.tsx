'use client'

import { useMemo, useState } from 'react'
import { Map, ZoomIn, ZoomOut } from 'lucide-react'
import type { PontoCalorMapa } from '@/lib/projecaoDemanda'
import {
  CIDADES_TRIPLICE_ORDEM,
  CATEGORIAS_MOBILIDADE_ORDEM,
  type CategoriaMobilidade,
  type CidadeTriplice,
} from '@/lib/mobilidadeRegional'
import type { ModoMapaCalor, PeriodoProjecao } from '@/lib/projecaoDemanda'
import FiltroSelectMercado from './FiltroSelectMercado'

/** Bounding box Tríplice Fronteira (lat/lng). */
const BBOX = { minLat: -25.75, maxLat: -25.45, minLng: -54.68, maxLng: -54.42 }

interface Props {
  pontos: PontoCalorMapa[]
  semTitulo?: boolean
  embed?: boolean
  periodo: PeriodoProjecao
  cidade: CidadeTriplice | 'todas'
  categoria: CategoriaMobilidade | 'todas'
  modo: ModoMapaCalor
  onPeriodoChange: (p: PeriodoProjecao) => void
  onCidadeChange: (c: CidadeTriplice | 'todas') => void
  onCategoriaChange: (c: CategoriaMobilidade | 'todas') => void
  onModoChange: (m: ModoMapaCalor) => void
}

function latLngParaSvg(lat: number, lng: number, zoom: number) {
  const cx = 50 + (lng - (BBOX.minLng + BBOX.maxLng) / 2) * 180 * zoom
  const cy = 50 - (lat - (BBOX.minLat + BBOX.maxLat) / 2) * 180 * zoom
  return { x: Math.max(5, Math.min(95, cx)), y: Math.max(5, Math.min(95, cy)) }
}

const OPCOES_PERIODO = [
  { valor: '7d' as const, rotulo: '7 dias' },
  { valor: '30d' as const, rotulo: '30 dias' },
  { valor: '90d' as const, rotulo: '90 dias' },
]

export default function MapaCalor({
  pontos,
  semTitulo = false,
  embed = false,
  periodo,
  cidade,
  categoria,
  modo,
  onPeriodoChange,
  onCidadeChange,
  onCategoriaChange,
  onModoChange,
}: Props) {
  const [zoom, setZoom] = useState(1)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const wrap = embed ? 'min-h-[20rem]' : 'min-h-[20rem] rounded-lg border bg-white p-4'

  const maxIntensidade = useMemo(() => Math.max(...pontos.map((p) => p.intensidade), 1), [pontos])

  const opcoesCidade = [
    { valor: 'todas' as const, rotulo: 'Todas as cidades' },
    ...CIDADES_TRIPLICE_ORDEM.map((c) => ({ valor: c, rotulo: c })),
  ]
  const opcoesCategoria = [
    { valor: 'todas' as const, rotulo: 'Todas as categorias' },
    ...CATEGORIAS_MOBILIDADE_ORDEM.map((c) => ({ valor: c, rotulo: c })),
  ]

  const pontoHover = pontos.find((p) => p.id === hoverId)

  return (
    <div className={wrap}>
      {!semTitulo ? (
        <h3 className="mb-3 flex items-center gap-2 font-bold text-[#001f3f]">
          <Map className="h-5 w-5 text-[#0097b2]" aria-hidden />
          Mapa de calor — mobilidade
        </h3>
      ) : null}

      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <FiltroSelectMercado rotulo="Período" valor={periodo} opcoes={OPCOES_PERIODO} onChange={onPeriodoChange} />
        <FiltroSelectMercado rotulo="Cidade" valor={cidade} opcoes={opcoesCidade} onChange={onCidadeChange} />
        <FiltroSelectMercado rotulo="Categoria" valor={categoria} opcoes={opcoesCategoria} onChange={onCategoriaChange} />
        <FiltroSelectMercado
          rotulo="Visualização"
          valor={modo}
          opcoes={[
            { valor: 'regiao' as const, rotulo: 'Por região' },
            { valor: 'geral' as const, rotulo: 'Atendimento geral' },
          ]}
          onChange={onModoChange}
        />
      </div>

      <div className="relative overflow-hidden rounded-lg border border-gray-200 bg-gradient-to-b from-[#e8f4f8] to-[#d4e8d4]">
        <div className="absolute right-2 top-2 z-10 flex flex-col gap-1">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(z + 0.25, 2.5))}
            className="rounded bg-white/90 p-1 shadow hover:bg-white"
            aria-label="Aumentar zoom"
          >
            <ZoomIn className="h-4 w-4 text-[#001f3f]" />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(z - 0.25, 0.75))}
            className="rounded bg-white/90 p-1 shadow hover:bg-white"
            aria-label="Diminuir zoom"
          >
            <ZoomOut className="h-4 w-4 text-[#001f3f]" />
          </button>
        </div>

        <svg viewBox="0 0 100 100" className="h-64 w-full sm:h-72">
          <rect x="0" y="0" width="100" height="100" fill="transparent" />
          <text x="22" y="42" fontSize="3" fill="#374151" opacity="0.7">
            Foz
          </text>
          <text x="58" y="48" fontSize="3" fill="#374151" opacity="0.7">
            CDE
          </text>
          <text x="38" y="72" fontSize="3" fill="#374151" opacity="0.7">
            Puerto
          </text>

          {pontos.map((p) => {
            const { x, y } = latLngParaSvg(p.lat, p.lng, zoom)
            const raio = 3 + (p.intensidade / maxIntensidade) * 12
            const opacidade = 0.25 + (p.intensidade / maxIntensidade) * 0.55
            return (
              <g
                key={p.id}
                onMouseEnter={() => setHoverId(p.id)}
                onMouseLeave={() => setHoverId(null)}
                className="cursor-pointer"
              >
                <circle cx={x} cy={y} r={raio} fill={`rgba(231, 76, 60, ${opacidade})`} stroke="#E74C3C" strokeWidth="0.3" />
                <circle cx={x} cy={y} r={raio * 0.5} fill={`rgba(231, 76, 60, ${opacidade + 0.15})`} />
                <title>
                  {p.label}: {p.total.toLocaleString('pt-BR')} atendimentos
                </title>
              </g>
            )
          })}
        </svg>

        {pontos.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60">
            <p className="px-4 text-center text-sm text-gray-500">
              Aguardando coordenadas de atendimentos concluídos na Tríplice Fronteira
            </p>
          </div>
        ) : null}
      </div>

      {pontoHover ? (
        <p className="mt-2 text-center text-xs text-gray-600">
          <span className="font-semibold text-[#001f3f]">{pontoHover.label}</span> —{' '}
          {pontoHover.total.toLocaleString('pt-BR')} atendimentos
        </p>
      ) : (
        <p className="mt-2 text-center text-xs text-gray-400">Passe o mouse sobre as áreas para ver detalhes</p>
      )}
    </div>
  )
}
