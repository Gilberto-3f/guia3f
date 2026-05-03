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
    <div className="space-y-0.5 text-gray-900">
      {dias.map((dia) => {
        const horario = horarios?.[dia.key]
        if (!horario) return null

        const pausa = Boolean(horario.pausa_almoco)
        const ai = horario.almoco_inicio != null ? String(horario.almoco_inicio).trim() : ''
        const af = horario.almoco_fim != null ? String(horario.almoco_fim).trim() : ''

        return (
          <div key={dia.key} className="flex flex-col gap-0.5 py-1">
            <div className="flex items-center justify-between gap-3">
              <span className="shrink-0 text-sm font-normal text-gray-700">{dia.nome}</span>
              {horario.fechado ? (
                <span className="text-right text-sm font-normal text-gray-500">Fechado</span>
              ) : (
                <span className="text-right text-sm font-normal tabular-nums text-gray-700">
                  {horario.abre} – {horario.fecha}
                </span>
              )}
            </div>
            {!horario.fechado && pausa && (ai && af) ? (
              <div className="pr-0.5 text-right text-xs text-gray-500">Almoço: {ai} – {af}</div>
            ) : !horario.fechado && pausa ? (
              <div className="pr-0.5 text-right text-xs text-amber-700">Pausa para almoço</div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
