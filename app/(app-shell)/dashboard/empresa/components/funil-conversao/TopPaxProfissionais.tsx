'use client'

import type { PaxProfissional } from '../../types/dashboard.types'

interface Props {
  topPax: PaxProfissional[]
}

export default function TopPaxProfissionais({ topPax }: Props) {
  if (topPax.length === 0) {
    return <div className="py-2 text-center text-sm text-gray-500">Nenhum PAX registrado no período</div>
  }

  return (
    <div className="space-y-2">
      <h4 className="font-bold text-[#001f3f]">PAX POR PROFISSIONAL (Top 5)</h4>
      {topPax.map((prof, index) => (
        <div key={prof.profissional_id} className="flex items-center justify-between border-b border-gray-100 py-1">
          <span className="text-gray-600">
            {index + 1}. @{prof.profissional_username}
          </span>
          <span className="font-medium text-[#001f3f]">{prof.total} PAX</span>
        </div>
      ))}
    </div>
  )
}

