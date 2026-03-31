'use client'

import type { RecomendacaoProfissional } from '../../types/dashboard.types'

interface Props {
  recomendacoes: RecomendacaoProfissional[]
}

const CATEGORIAS_LABELS: Record<string, string> = {
  guias: '🚐 Guias de Turismo',
  taxistas: '🚕 Taxistas',
  vans: '🚌 Motoristas de Van',
  apps: '📱 Motoristas de App',
  anfitrioes: '🏨 Anfitriões',
  outros: '👤 Outros',
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
        return (
          <div key={categoria}>
            <p className="font-medium text-gray-700">
              {CATEGORIAS_LABELS[categoria] || categoria} ({totalCategoria})
            </p>
            <div className="ml-4 space-y-1">
              {items.map((rec) => (
                <div key={rec.profissional_id} className="text-sm text-gray-600">
                  ├── @{rec.profissional_username} · {rec.total}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

