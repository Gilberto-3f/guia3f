'use client'

import type { RecomendacaoProfissional } from '../../types/dashboard.types'
import { Bus, Car, CircleUser, Hotel, Smartphone } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface Props {
  recomendacoes: RecomendacaoProfissional[]
}

const CATEGORIAS_LABELS: Record<string, { label: string; Icon: LucideIcon }> = {
  guias: { label: 'Guias de Turismo', Icon: Bus },
  taxistas: { label: 'Taxistas', Icon: Car },
  vans: { label: 'Motoristas de Van', Icon: Bus },
  apps: { label: 'Motoristas de App', Icon: Smartphone },
  anfitrioes: { label: 'Anfitriões', Icon: Hotel },
  outros: { label: 'Outros', Icon: CircleUser },
}

function rotuloCategoria(categoria: string) {
  const hit = CATEGORIAS_LABELS[categoria]
  if (hit) return hit
  return { label: categoria, Icon: CircleUser }
}

export default function CardRecomendacoes({ recomendacoes }: Props) {
  const porCategoria: Record<string, RecomendacaoProfissional[]> = {}
  for (const rec of recomendacoes) {
    const key = rec.categoria || 'outros'
    if (!porCategoria[key]) porCategoria[key] = []
    porCategoria[key].push(rec)
  }

  const categorias = Object.entries(porCategoria).sort((a, b) => {
    const ta = a[1].reduce((sum, i) => sum + i.total, 0)
    const tb = b[1].reduce((sum, i) => sum + i.total, 0)
    return tb - ta
  })

  if (recomendacoes.length === 0) {
    return <div className="py-2 text-center text-sm text-gray-500">Nenhuma recomendação no período</div>
  }

  return (
    <div className="space-y-3">
      <h4 className="font-bold text-[#001f3f]">RECOMENDAÇÕES POR PROFISSIONAL</h4>
      {categorias.map(([categoria, items]) => {
        const totalCategoria = items.reduce((sum, i) => sum + i.total, 0)
        const { label, Icon } = rotuloCategoria(categoria)
        return (
          <div key={categoria}>
            <p className="flex items-center gap-2 font-medium text-gray-700">
              <Icon className="h-4 w-4 text-[#0097b2]" aria-hidden />
              {label} ({totalCategoria})
            </p>
            <div className="ml-6 space-y-1">
              {items.map((rec) => (
                <div key={rec.profissional_id} className="text-sm text-gray-600">
                  @{rec.profissional_username} · {rec.total}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
