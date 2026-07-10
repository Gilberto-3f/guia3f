'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  COR_AZUL_LOGO,
  COR_VERDE_BOTAO,
  diaOcupado,
  listarDatasDoMes,
  type PeriodoOcupacao,
} from '@/lib/hospedagemCalendario'

const DIAS_SEM = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

type Props = {
  periodos: PeriodoOcupacao[]
  /** Datas selecionadas para bloqueio (modo edição) */
  selecao?: Set<string>
  onToggleDia?: (iso: string) => void
  modoSelecao?: boolean
  className?: string
}

export default function CalendarioAcomodacao({
  periodos,
  selecao,
  onToggleDia,
  modoSelecao = false,
  className = '',
}: Props) {
  const hoje = new Date()
  const [ano, setAno] = useState(hoje.getFullYear())
  const [mes, setMes] = useState(hoje.getMonth())

  const cells = useMemo(() => listarDatasDoMes(ano, mes), [ano, mes])
  const titulo = useMemo(
    () =>
      new Date(ano, mes, 1).toLocaleDateString('pt-BR', {
        month: 'long',
        year: 'numeric',
      }),
    [ano, mes],
  )

  const prev = () => {
    if (mes === 0) {
      setMes(11)
      setAno((a) => a - 1)
    } else setMes((m) => m - 1)
  }

  const next = () => {
    if (mes === 11) {
      setMes(0)
      setAno((a) => a + 1)
    } else setMes((m) => m + 1)
  }

  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-3 ${className}`}>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={prev}
          className="rounded-lg p-1.5 text-[#0097b2] hover:bg-[#0097b2]/10"
          aria-label="Mês anterior"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
        <p className="text-sm font-bold capitalize text-[#001f3f]">{titulo}</p>
        <button
          type="button"
          onClick={next}
          className="rounded-lg p-1.5 text-[#0097b2] hover:bg-[#0097b2]/10"
          aria-label="Próximo mês"
        >
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1">
        {DIAS_SEM.map((d) => (
          <div key={d} className="text-center text-[10px] font-semibold text-gray-500">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((iso, idx) => {
          if (!iso) return <div key={`e-${idx}`} className="aspect-square" />
          const ocupado = diaOcupado(periodos, iso)
          const selecionado = selecao?.has(iso) ?? false
          const bg = selecionado
            ? '#001f3f'
            : ocupado
              ? COR_AZUL_LOGO
              : COR_VERDE_BOTAO
          const clicavel = modoSelecao && onToggleDia

          return (
            <button
              key={iso}
              type="button"
              disabled={!clicavel}
              onClick={() => onToggleDia?.(iso)}
              className="aspect-square rounded-md text-[11px] font-semibold text-white disabled:cursor-default"
              style={{ backgroundColor: bg }}
              title={ocupado ? 'Ocupado' : 'Disponível'}
            >
              {Number(iso.slice(8, 10))}
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-gray-600">
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COR_VERDE_BOTAO }} />
          Disponível
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COR_AZUL_LOGO }} />
          Ocupado
        </span>
      </div>
    </div>
  )
}
