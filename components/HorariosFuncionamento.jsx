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
 * @param {{ horarios: Record<string, { abre: string, fecha: string, fechado: boolean, pausa_almoco?: boolean, almoco_inicio?: string, almoco_fim?: string }> }} props
 */
export default function HorariosFuncionamento({ horarios }) {
  return (
    <div className="space-y-2 text-gray-900">
      {dias.map((dia) => {
        const horario = horarios?.[dia.key]
        if (!horario) return null

        const pausa = Boolean(horario.pausa_almoco)
        const ai = horario.almoco_inicio != null ? String(horario.almoco_inicio).trim() : ''
        const af = horario.almoco_fim != null ? String(horario.almoco_fim).trim() : ''

        return (
          <div key={dia.key} className="flex flex-col gap-0.5 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-x-4">
            <span className="font-semibold text-gray-800">{dia.nome}</span>
            {horario.fechado ? (
              <span className="font-semibold text-red-600">Fechado</span>
            ) : (
              <div className="flex flex-col items-end gap-0.5 text-right sm:items-end">
                <span className="font-semibold tabular-nums text-gray-900">
                  {horario.abre} – {horario.fecha}
                </span>
                {pausa && ai && af ? (
                  <span className="text-sm font-medium text-gray-600">Almoço: {ai} – {af}</span>
                ) : pausa ? (
                  <span className="text-sm font-medium text-amber-700">Pausa para almoço</span>
                ) : null}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
