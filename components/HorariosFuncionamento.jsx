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
    <div className="space-y-1">
      {dias.map((dia) => {
        const horario = horarios?.[dia.key]
        if (!horario) return null

        return (
          <div key={dia.key} className="flex justify-between text-sm">
            <span className="text-gray-600">{dia.nome}</span>
            {horario.fechado ? (
              <span className="text-red-500">Fechado</span>
            ) : (
              <span className="text-gray-700">
                {horario.abre} - {horario.fecha}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
