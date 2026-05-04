'use client'

const dias = [
  { key: 'segunda', nome: 'Segunda-feira' },
  { key: 'terca', nome: 'Terça-feira' },
  { key: 'quarta', nome: 'Quarta-feira' },
  { key: 'quinta', nome: 'Quinta-feira' },
  { key: 'sexta', nome: 'Sexta-feira' },
  { key: 'sabado', nome: 'Sábado' },
  { key: 'domingo', nome: 'Domingo' },
]

/**
 * @param {{ horarios: Record<string, { abre: string, fecha: string, fechado: boolean, pausa_almoco?: boolean, almoco_inicio?: string, almoco_fim?: string }> }} props
 */
export default function HorariosFuncionamento({ horarios }) {
  return (
    <div className="text-gray-900">
      {dias.map((dia) => {
        const horario = horarios?.[dia.key]
        if (!horario) return null

        const pausa = Boolean(horario.pausa_almoco)
        const ai = horario.almoco_inicio != null ? String(horario.almoco_inicio).trim() : ''
        const af = horario.almoco_fim != null ? String(horario.almoco_fim).trim() : ''

        return (
          <div key={dia.key} className="mb-3 flex flex-col gap-0 last:mb-0">
            <div className="flex items-center gap-2 py-1">
              <span className="shrink-0 text-sm font-normal text-gray-700">{dia.nome}</span>
              {horario.fechado ? (
                <span className="text-sm font-normal text-gray-500">Fechado</span>
              ) : (
                <span className="text-sm font-normal tabular-nums text-gray-700">
                  {horario.abre} – {horario.fecha}
                </span>
              )}
            </div>
            {!horario.fechado && pausa && (ai && af) ? (
              <div className="text-left text-sm text-gray-500">
                Horário de almoço: {ai} – {af}
              </div>
            ) : !horario.fechado && pausa ? (
              <div className="text-left text-sm text-amber-700">Horário de almoço: a combinar</div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
