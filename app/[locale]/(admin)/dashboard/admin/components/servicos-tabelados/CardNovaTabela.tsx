'use client'

import { useState } from 'react'
import { Info } from 'lucide-react'
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
  const [infoValorAberto, setInfoValorAberto] = useState(false)
  const [infoPeriodoAberto, setInfoPeriodoAberto] = useState(false)

  const inputCls =
    'mt-1.5 w-full min-w-0 rounded-lg border border-gray-200 px-3 py-3 text-base text-gray-900 outline-none focus:border-[#0097b2] sm:py-2.5 sm:text-sm'
  const timeInputCls =
    'mt-1 w-full min-w-0 rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#0097b2]'
  const labelCls = 'block text-xs font-semibold uppercase tracking-wide text-gray-500 sm:text-[11px]'
  const radioLabelCls =
    'flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium leading-snug text-gray-900 sm:items-center'

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
          <fieldset className="min-w-0 space-y-3 overflow-hidden rounded-xl border border-gray-100 bg-[#f5f5f5] p-4">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Período do serviço
              </span>
              <button
                type="button"
                onClick={() => setInfoPeriodoAberto((v) => !v)}
                className="inline-flex rounded-full p-0.5 text-[#0097b2] hover:bg-[#0097b2]/10"
                aria-label="Informação sobre o período do serviço"
                aria-expanded={infoPeriodoAberto}
              >
                <Info className="h-4 w-4" aria-hidden />
              </button>
            </div>
            {infoPeriodoAberto ? (
              <p className="text-xs leading-relaxed text-gray-600 sm:text-sm">
                Escolha um tipo por tabela: acompanhamento presencial nos atrativos ou diária pelo período
                combinado.
              </p>
            ) : null}
            <div className="flex flex-col gap-2">
              <label className={radioLabelCls}>
                <input
                  type="radio"
                  name="tipo-periodo-guia"
                  checked={tipoPeriodoGuia === 'acompanhamento'}
                  onChange={() => setTipoPeriodoGuia('acompanhamento')}
                  className="mt-0.5 shrink-0 accent-[#00D443] sm:mt-0"
                />
                <span className="text-gray-900">Acompanhamento (média padrão)</span>
              </label>
              <label className={radioLabelCls}>
                <input
                  type="radio"
                  name="tipo-periodo-guia"
                  checked={tipoPeriodoGuia === 'diaria'}
                  onChange={() => setTipoPeriodoGuia('diaria')}
                  className="mt-0.5 shrink-0 accent-[#00D443] sm:mt-0"
                />
                <span className="text-gray-900">Diária (período combinado)</span>
              </label>
            </div>
            <div className="grid min-w-0 grid-cols-1 gap-2">
              <label className="min-w-0 text-xs font-semibold text-gray-700">
                Das
                <input
                  type="time"
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(e.target.value)}
                  className={timeInputCls}
                />
              </label>
              <label className="min-w-0 text-xs font-semibold text-gray-700">
                Às
                <input
                  type="time"
                  value={horaFim}
                  onChange={(e) => setHoraFim(e.target.value)}
                  className={timeInputCls}
                />
              </label>
            </div>
          </fieldset>
        ) : null}

        {categoria === 'van' ? (
          <fieldset className="min-w-0 space-y-3 overflow-hidden rounded-xl border border-gray-100 bg-[#f5f5f5] p-4">
            <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500">Ida e volta</span>
            <p className="text-xs leading-relaxed text-gray-600 sm:text-sm">
              Horários de transporte (saída e retorno no ponto combinado). O passageiro visita os atrativos por conta
              própria.
            </p>
            <div className="grid min-w-0 grid-cols-1 gap-2">
              <label className="min-w-0 text-xs font-semibold text-gray-700">
                Saída às
                <input
                  type="time"
                  value={horaSaida}
                  onChange={(e) => setHoraSaida(e.target.value)}
                  className={timeInputCls}
                />
              </label>
              <label className="min-w-0 text-xs font-semibold text-gray-700">
                Retorno às
                <input
                  type="time"
                  value={horaRetorno}
                  onChange={(e) => setHoraRetorno(e.target.value)}
                  className={timeInputCls}
                />
              </label>
            </div>
          </fieldset>
        ) : null}

        <label className={labelCls}>
          <span className="inline-flex items-center gap-1.5">
            Valor da Rota
            <button
              type="button"
              onClick={() => setInfoValorAberto((v) => !v)}
              className="inline-flex rounded-full p-0.5 text-[#0097b2] hover:bg-[#0097b2]/10"
              aria-label="Informação sobre o valor da rota"
              aria-expanded={infoValorAberto}
            >
              <Info className="h-4 w-4" aria-hidden />
            </button>
          </span>
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
              className="w-full min-w-0 rounded-lg border border-gray-200 py-3 pl-9 pr-3 text-base text-gray-900 outline-none focus:border-[#0097b2] sm:py-2.5 sm:text-sm"
            />
          </div>
          {infoValorAberto ? (
            <p className="mt-2 rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-2 text-xs leading-relaxed text-gray-600">
              Apenas deslocamento do trajeto. Tickets negociados à parte nos botões dinâmicos.
            </p>
          ) : null}
        </label>
      </div>

      {erro ? <p className="mt-4 text-sm text-rose-600">{erro}</p> : null}

      <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:gap-3">
        <button
          type="button"
          onClick={() => void confirmar()}
          disabled={salvando}
          className="w-full rounded-xl bg-[#00D443] py-3 text-sm font-bold text-white disabled:opacity-50 sm:flex-1 sm:py-2.5"
        >
          {salvando ? 'Salvando…' : 'Confirmar'}
        </button>
        <button
          type="button"
          onClick={onCancelar}
          disabled={salvando}
          className="w-full rounded-xl bg-red-600 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50 sm:flex-1 sm:py-2.5"
        >
          Cancelar
        </button>
      </div>
    </article>
  )
}
