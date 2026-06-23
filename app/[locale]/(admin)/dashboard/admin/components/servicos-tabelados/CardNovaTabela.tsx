'use client'

import { useState } from 'react'
import type { CategoriaTabeladoId, TipoPeriodoGuia } from '@/lib/servicosTabeladosCatalogo'

export type NovaTabelaFormData = {
  destino: string
  valor: number
  tipoPeriodoGuia?: TipoPeriodoGuia
  horaInicio?: string
  horaFim?: string
  horaSaida?: string
  horaRetorno?: string
}

export function CardNovaTabela({
  categoria,
  pontoPartida,
  salvando,
  onConfirmar,
  onCancelar,
}: {
  categoria: CategoriaTabeladoId
  pontoPartida: string
  salvando: boolean
  onConfirmar: (dados: NovaTabelaFormData) => Promise<{ success: boolean; error?: unknown }>
  onCancelar: () => void
}) {
  const [destino, setDestino] = useState('')
  const [valor, setValor] = useState('')
  const [tipoPeriodoGuia, setTipoPeriodoGuia] = useState<TipoPeriodoGuia>('acompanhamento')
  const [horaInicio, setHoraInicio] = useState('')
  const [horaFim, setHoraFim] = useState('')
  const [horaSaida, setHoraSaida] = useState('')
  const [horaRetorno, setHoraRetorno] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  const inputCls =
    'mt-1.5 w-full min-w-0 rounded-lg border border-gray-200 px-3 py-3 text-base text-gray-900 outline-none focus:border-[#0097b2] sm:py-2.5 sm:text-sm'
  const labelCls = 'block text-xs font-semibold uppercase tracking-wide text-gray-500 sm:text-[11px]'

  const confirmar = async () => {
    setErro(null)
    const valorNum = Number(valor)
    if (!destino.trim()) {
      setErro('Informe o destino final.')
      return
    }
    if (!Number.isFinite(valorNum) || valorNum < 0) {
      setErro('Informe o valor da rota.')
      return
    }
    if (categoria === 'guia' && (!horaInicio || !horaFim)) {
      setErro('Informe o horário de início e fim do período.')
      return
    }
    if (categoria === 'van' && (!horaSaida || !horaRetorno)) {
      setErro('Informe o horário de saída e retorno.')
      return
    }

    const dados: NovaTabelaFormData = {
      destino: destino.trim(),
      valor: valorNum,
    }
    if (categoria === 'guia') {
      dados.tipoPeriodoGuia = tipoPeriodoGuia
      dados.horaInicio = horaInicio
      dados.horaFim = horaFim
    }
    if (categoria === 'van') {
      dados.horaSaida = horaSaida
      dados.horaRetorno = horaRetorno
    }

    const res = await onConfirmar(dados)
    if (!res.success) {
      const msg =
        res.error instanceof Error
          ? res.error.message
          : typeof res.error === 'object' && res.error && 'message' in res.error
            ? String((res.error as { message: string }).message)
            : 'Não foi possível salvar.'
      setErro(msg)
    }
  }

  return (
    <article className="w-full rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <h3 className="text-sm font-bold uppercase tracking-wide text-[#0097b2] sm:text-base">Nova Tabela</h3>

      <div className="mt-4 space-y-4 sm:space-y-5">
        <label className={labelCls}>
          Ponto de Partida
          <input type="text" readOnly value={pontoPartida} className={`${inputCls} bg-gray-50 text-gray-800`} />
        </label>

        <label className={labelCls}>
          Destino Final
          <input
            type="text"
            value={destino}
            onChange={(e) => setDestino(e.target.value.slice(0, 200))}
            placeholder="Para onde vai a rota?"
            className={inputCls}
          />
        </label>

        {categoria === 'guia' ? (
          <fieldset className="space-y-3 rounded-xl border border-gray-100 bg-[#f5f5f5] p-4 sm:p-5">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Período do serviço
            </legend>
            <p className="text-xs leading-relaxed text-gray-600 sm:text-sm">
              Escolha um tipo por tabela: acompanhamento presencial nos atrativos ou diária pelo período combinado.
            </p>
            <div className="flex flex-col gap-2.5">
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 bg-white px-3 py-3 text-sm leading-snug sm:items-center sm:py-2.5">
                <input
                  type="radio"
                  name="tipo-periodo-guia"
                  checked={tipoPeriodoGuia === 'acompanhamento'}
                  onChange={() => setTipoPeriodoGuia('acompanhamento')}
                  className="mt-0.5 shrink-0 accent-[#00D443] sm:mt-0"
                />
                <span>Acompanhamento (média padrão)</span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 bg-white px-3 py-3 text-sm leading-snug sm:items-center sm:py-2.5">
                <input
                  type="radio"
                  name="tipo-periodo-guia"
                  checked={tipoPeriodoGuia === 'diaria'}
                  onChange={() => setTipoPeriodoGuia('diaria')}
                  className="mt-0.5 shrink-0 accent-[#00D443] sm:mt-0"
                />
                <span>Diária (período combinado)</span>
              </label>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              <label className="block text-xs font-semibold text-gray-600 sm:text-sm">
                Das
                <input
                  type="time"
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(e.target.value)}
                  className={inputCls}
                />
              </label>
              <label className="block text-xs font-semibold text-gray-600 sm:text-sm">
                Às
                <input
                  type="time"
                  value={horaFim}
                  onChange={(e) => setHoraFim(e.target.value)}
                  className={inputCls}
                />
              </label>
            </div>
          </fieldset>
        ) : null}

        {categoria === 'van' ? (
          <fieldset className="space-y-3 rounded-xl border border-gray-100 bg-[#f5f5f5] p-4 sm:p-5">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Ida e volta
            </legend>
            <p className="text-xs leading-relaxed text-gray-600 sm:text-sm">
              Horários de transporte (saída e retorno no ponto combinado). O passageiro visita os atrativos por conta
              própria.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              <label className="block text-xs font-semibold text-gray-600 sm:text-sm">
                Saída às
                <input
                  type="time"
                  value={horaSaida}
                  onChange={(e) => setHoraSaida(e.target.value)}
                  className={inputCls}
                />
              </label>
              <label className="block text-xs font-semibold text-gray-600 sm:text-sm">
                Retorno às
                <input
                  type="time"
                  value={horaRetorno}
                  onChange={(e) => setHoraRetorno(e.target.value)}
                  className={inputCls}
                />
              </label>
            </div>
          </fieldset>
        ) : null}

        <label className={labelCls}>
          Valor da Rota
          <div className="relative mt-1.5">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
              R$
            </span>
            <input
              type="number"
              min={0}
              step={0.01}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
              className="w-full min-w-0 rounded-lg border border-gray-200 py-3 pl-9 pr-3 text-base outline-none focus:border-[#0097b2] sm:py-2.5 sm:text-sm"
            />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-gray-500">
            Apenas deslocamento do trajeto. Tickets negociados à parte nos botões dinâmicos.
          </p>
        </label>
      </div>

      {erro ? <p className="mt-4 text-sm text-rose-600">{erro}</p> : null}

      <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:gap-3">
        <button
          type="button"
          onClick={onCancelar}
          disabled={salvando}
          className="w-full rounded-xl border border-gray-300 bg-white py-3 text-sm font-bold text-gray-700 disabled:opacity-50 sm:flex-1 sm:py-2.5"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => void confirmar()}
          disabled={salvando}
          className="w-full rounded-xl bg-[#00D443] py-3 text-sm font-bold text-white disabled:opacity-50 sm:flex-1 sm:py-2.5"
        >
          {salvando ? 'Salvando…' : 'Confirmar'}
        </button>
      </div>
    </article>
  )
}
