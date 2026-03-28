'use client'

import { useMemo } from 'react'
import type { Infracao } from '../../hooks/useInfracoes'

export default function TabelaPenalidades({ infracoes }: { infracoes: Infracao[] }) {
  const leves = useMemo(() => infracoes.filter((i) => i.tipo === 'leve'), [infracoes])

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="min-w-full">
        <thead className="bg-gray-50 text-left text-xs text-gray-600">
          <tr>
            <th className="px-3 py-2">Infração</th>
            <th className="px-3 py-2">Categoria</th>
            <th className="px-3 py-2">1ª ocorrência</th>
            <th className="px-3 py-2">2ª ocorrência</th>
            <th className="px-3 py-2">3ª ocorrência</th>
            <th className="px-3 py-2">Alerta</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 text-sm">
          {leves.map((inf) => (
            <tr key={inf.id}>
              <td className="px-3 py-2">{inf.descricao}</td>
              <td className="px-3 py-2 capitalize">{inf.categoria}</td>
              <td className="px-3 py-2 text-yellow-700">Advertência</td>
              <td className="px-3 py-2 text-orange-700">Advertência + restrição</td>
              <td className="px-3 py-2 text-red-700">Suspensão</td>
              <td className="px-3 py-2">{inf.alerta_preventivo ? `Sim (${inf.horas_alerta}h)` : 'Não'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
