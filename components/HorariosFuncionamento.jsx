'use client'

const dias = [
  { key: 'segunda', nome: 'Segunda' },
  { key: 'terca', nome: 'Terça' },
  { key: 'quarta', nome: 'Quarta' },
  { key: 'quinta', nome: 'Quinta' },
  { key: 'sexta', nome: 'Sexta' },
  { key: 'sabado', nome: 'Sábado' },
  { key: 'domingo', nome: 'Domingo' },
]

/**
 * @param {{ horarios: Record<string, { abre: string, fecha: string, fechado: boolean }> }} props
 */
export default function HorariosFuncionamento({ horarios }) {
  return (
    <div className="space-y-2 text-gray-900">
      {dias.map((dia) => {
        const horario = horarios?.[dia.key]
        if (!horario) return null

        return (
          <div key={dia.key} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-base sm:text-lg">
            <span className="font-semibold text-gray-800">{dia.nome}</span>
            {horario.fechado ? (
              <span className="font-semibold text-red-600">Fechado</span>
            ) : (
              <span className="font-semibold tabular-nums text-gray-900">
                {horario.abre} – {horario.fecha}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
