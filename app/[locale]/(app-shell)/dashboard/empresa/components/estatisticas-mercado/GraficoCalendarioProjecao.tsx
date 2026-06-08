'use client'

import { useMemo, useState } from 'react'
import type { MesCalendarioProjecao, NivelDiaProjecao } from '@/lib/projecaoDemanda'
import { DIAS_SEMANA_LABEL } from '@/lib/projecaoDemanda'

interface Props {
  meses: MesCalendarioProjecao[]
  unidade?: '%' | 'qtd'
  semTitulo?: boolean
  embed?: boolean
  mostrarComZero?: boolean
}

const COR_NIVEL: Record<NivelDiaProjecao, string> = {
  forte: 'bg-emerald-200 hover:bg-emerald-300',
  intermediario: 'bg-sky-200 hover:bg-sky-300',
  fraco: 'bg-gray-200 hover:bg-gray-300',
}

const ROTULO_NIVEL: Record<NivelDiaProjecao, string> = {
  forte: 'Dia forte',
  intermediario: 'Dia intermediário',
  fraco: 'Dia fraco',
}

function formatarValor(v: number, unidade: '%' | 'qtd') {
  return unidade === '%' ? `${v.toFixed(0)}%` : v.toLocaleString('pt-BR')
}

export default function GraficoCalendarioProjecao({
  meses,
  unidade = '%',
  semTitulo = false,
  embed = false,
  mostrarComZero = true,
}: Props) {
  const [tooltip, setTooltip] = useState<string | null>(null)
  const wrap = embed ? 'min-h-[14rem]' : 'min-h-[14rem] rounded-lg border bg-white p-4'

  const temDados = useMemo(
    () => meses.some((m) => m.dias.some((d) => d.valor > 0)),
    [meses],
  )

  if (meses.length === 0 || (!mostrarComZero && !temDados)) {
    return (
      <div className={wrap}>
        {!semTitulo ? <h3 className="mb-4 font-bold text-[#001f3f]">Projeção</h3> : null}
        <div className="flex h-48 items-center justify-center text-sm text-gray-500">
          Nenhum dado disponível para projeção
        </div>
      </div>
    )
  }

  return (
    <div className={wrap}>
      {!semTitulo ? <h3 className="mb-4 font-bold text-[#001f3f]">Projeção — próximos 6 meses</h3> : null}

      <div className="mb-4 flex flex-wrap justify-center gap-3 text-[11px] text-gray-600">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-emerald-200" /> Dias bons
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-sky-200" /> Dias intermediários
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-gray-200" /> Dias fracos
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {meses.map((mes) => (
          <div
            key={`${mes.ano}-${mes.mes}`}
            className="rounded-lg border border-gray-100 bg-gray-50/80 p-3"
          >
            <p className="mb-2 text-center text-xs font-semibold capitalize text-[#001f3f]">
              {mes.mesLabelLongo}
            </p>
            <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[8px] font-medium text-gray-400">
              {DIAS_SEMANA_LABEL.map((label, i) => (
                <span key={`${mes.mes}-dow-${i}`}>{label}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {Array.from({ length: mes.offsetSemana }).map((_, i) => (
                <div key={`pad-${mes.mes}-${i}`} className="aspect-square" />
              ))}
              {mes.dias.map((dia) => {
                const passado = new Date(dia.data + 'T12:00:00') < new Date(new Date().toDateString())
                const tip = passado
                  ? `${dia.data}: dia passado`
                  : `${dia.data}: ${ROTULO_NIVEL[dia.nivel]} — ${formatarValor(dia.valor, unidade)}${dia.confirmado ? ' (reserva confirmada)' : ' (projetado)'}`
                return (
                  <button
                    key={dia.data}
                    type="button"
                    disabled={passado}
                    className={`aspect-square rounded-sm text-[9px] font-medium tabular-nums transition-colors ${
                      passado
                        ? 'cursor-default bg-gray-100 text-gray-300'
                        : `text-gray-700 ${COR_NIVEL[dia.nivel]} ${dia.confirmado ? 'ring-1 ring-[#001f3f]/20' : ''}`
                    }`}
                    title={tip}
                    onMouseEnter={() => setTooltip(tip)}
                    onMouseLeave={() => setTooltip(null)}
                    onFocus={() => setTooltip(tip)}
                    onBlur={() => setTooltip(null)}
                  >
                    {dia.dia}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {tooltip ? (
        <p className="mt-3 rounded-md bg-gray-50 px-3 py-2 text-center text-xs text-gray-600">{tooltip}</p>
      ) : (
        <p className="mt-3 text-center text-[11px] text-gray-400">
          Projeção com base nas reservas do app · verde = alta demanda · azul = média · cinza = baixa
        </p>
      )}
    </div>
  )
}
