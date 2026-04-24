'use client'

import { useEffect, useState } from 'react'

/**
 * @param {{ horarios: Record<string, { abre: string, fecha: string, fechado: boolean }> }} props
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

    const aberto = horaAtual >= horarioHoje.abre && horaAtual <= horarioHoje.fecha
    setStatus(aberto ? 'aberto' : 'fechado')
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
