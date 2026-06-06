'use client'

import { useState } from 'react'
import { Bus, Car, Hotel, Smartphone, type LucideIcon } from 'lucide-react'
import type { RecomendacaoProfissional } from '../../types/dashboard.types'
import PastaEstatistica from '../estatisticas-mercado/PastaEstatistica'
import LinhaProfissionalRecomendacao from './LinhaProfissionalRecomendacao'

interface Props {
  recomendacoes: RecomendacaoProfissional[]
}

const CATEGORIAS_ORDEM = ['guias', 'taxistas', 'vans', 'apps', 'anfitrioes'] as const

const CATEGORIAS_CONFIG: Record<(typeof CATEGORIAS_ORDEM)[number], { label: string; Icon: LucideIcon }> = {
  guias: { label: 'Guias de Turismo', Icon: Bus },
  taxistas: { label: 'Taxistas', Icon: Car },
  vans: { label: 'Motoristas de Van', Icon: Bus },
  apps: { label: 'Motoristas de App', Icon: Smartphone },
  anfitrioes: { label: 'Anfitriões', Icon: Hotel },
}

export default function CardRecomendacoes({ recomendacoes }: Props) {
  const [pastaAberta, setPastaAberta] = useState<string | null>(null)

  const porCategoria: Record<string, RecomendacaoProfissional[]> = {}
  for (const cat of CATEGORIAS_ORDEM) {
    porCategoria[cat] = []
  }
  for (const rec of recomendacoes) {
    const key = (CATEGORIAS_ORDEM as readonly string[]).includes(rec.categoria) ? rec.categoria : 'outros'
    if (key !== 'outros' && porCategoria[key]) {
      porCategoria[key].push(rec)
    }
  }

  const togglePasta = (id: string) => {
    setPastaAberta((atual) => (atual === id ? null : id))
  }

  return (
    <div className="space-y-2">
      {CATEGORIAS_ORDEM.map((categoria) => {
        const items = porCategoria[categoria] ?? []
        const totalCategoria = items.reduce((sum, i) => sum + i.total, 0)
        const { label, Icon } = CATEGORIAS_CONFIG[categoria]

        return (
          <PastaEstatistica
            key={categoria}
            id={`rec-${categoria}`}
            titulo={`${label} (${totalCategoria})`}
            icon={Icon}
            controlado
            aberto={pastaAberta === categoria}
            onToggle={() => togglePasta(categoria)}
          >
            {items.length === 0 ? (
              <p className="py-2 text-center text-sm text-gray-500">Nenhuma recomendação nesta categoria</p>
            ) : (
              <div className="rounded-lg border border-gray-100 bg-white">
                {items.map((prof) => (
                  <LinhaProfissionalRecomendacao key={prof.profissional_id} profissional={prof} />
                ))}
              </div>
            )}
          </PastaEstatistica>
        )
      })}
    </div>
  )
}
