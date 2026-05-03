'use client'

import { useEffect, useState } from 'react'

/**
 * @param {{ horarios: Record<string, { abre: string, fecha: string, fechado: boolean, pausa_almoco?: boolean, almoco_inicio?: string, almoco_fim?: string }> }} props
 */
export default function StatusAtendimento({ horarios }) {
  const [status, setStatus] = useState(/** @type {'aberto' | 'fechado'} */ ('fechado'))

  useEffect(() => {
    const diasSemana = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']
    const agora = new Date()
    const diaAtual = diasSemana[agora.getDay()]
    const horaAtual =
      agora.getHours().toString().padStart(2, '0') + ':' + agora.getMinutes().toString().padStart(2, '0')

    const horarioHoje = horarios?.[diaAtual]

    if (!horarioHoje || horarioHoje.fechado) {
      setStatus('fechado')
      return
    }

    const abre = String(horarioHoje.abre ?? '')
    const fecha = String(horarioHoje.fecha ?? '')
    if (!abre || !fecha || horaAtual < abre || horaAtual > fecha) {
      setStatus('fechado')
      return
    }

    const pausa = Boolean(horarioHoje.pausa_almoco)
    const ai = horarioHoje.almoco_inicio != null ? String(horarioHoje.almoco_inicio).trim() : ''
    const af = horarioHoje.almoco_fim != null ? String(horarioHoje.almoco_fim).trim() : ''
    if (pausa && ai && af && horaAtual >= ai && horaAtual < af) {
      setStatus('fechado')
      return
    }

    setStatus('aberto')
  }, [horarios])

  return (
    <div className="flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${status === 'aberto' ? 'bg-green-500' : 'bg-red-500'}`} aria-hidden />
      <span
        className={`text-sm font-semibold ${
          status === 'aberto' ? 'text-green-800' : 'text-red-800'
        }`}
      >
        {status === 'aberto' ? 'Aberto' : 'Fechado'}
      </span>
    </div>
  )
}
