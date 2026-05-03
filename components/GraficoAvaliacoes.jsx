'use client'

/**
 * @param {{ distribuicao: Record<number, number>, total: number }} props
 */
export default function GraficoAvaliacoes({ distribuicao, total }) {
  const notas = [5, 4, 3, 2, 1]

  return (
    <div className="space-y-2">
      {notas.map((nota) => {
        const quantidade = distribuicao[nota] ?? 0
        const porcentagem = total > 0 ? (quantidade / total) * 100 : 0

        return (
          <div key={nota} className="flex items-center gap-2">
            <span className="w-8 text-sm">
              {nota} ★
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200">
              <div className="h-full rounded-full bg-[#0097b2]" style={{ width: `${porcentagem}%` }} />
            </div>
            <span className="w-10 text-xs text-gray-500">{quantidade}</span>
          </div>
        )
      })}
    </div>
  )
}
