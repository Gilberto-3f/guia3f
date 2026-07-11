'use client'

import { useMemo, useState } from 'react'
import { Check, Search, X } from 'lucide-react'
import BotaoInfoPopup from '@/components/ui/BotaoInfoPopup'
import { useModalScrollLock } from '@/lib/useModalScrollLock'
import { COMODIDADES_FILTRO_CHECK } from '@/lib/hospedagemFiltroCheck'
import type { CriteriosFiltroHospedagemCheck } from '@/lib/hospedagemFiltroCheck'

const COR = '#0097b2'
const VERDE = '#00D443'

const TEXTO_INFO =
  'Nos informe as características da acomodação que você deseja, para refinarmos essa pesquisa e localizarmos acomodações que combinem com sua busca, preencha o questionário.'

type Props = {
  isOpen: boolean
  onClose: () => void
  onPesquisar: (criterios: CriteriosFiltroHospedagemCheck) => void
  onLimpar?: () => void
  filtroAtivo?: boolean
  pesquisando?: boolean
}

function SimNao({
  value,
  onChange,
}: {
  value: boolean | null
  onChange: (v: boolean) => void
}) {
  return (
    <div className="mt-1.5 flex gap-2">
      {[
        { v: true, label: 'Sim' },
        { v: false, label: 'Não' },
      ].map((op) => (
        <button
          key={String(op.v)}
          type="button"
          onClick={() => onChange(op.v)}
          className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${
            value === op.v
              ? 'border-[#0097b2] bg-[#0097b2] text-white'
              : 'border-gray-200 bg-white text-gray-700'
          }`}
        >
          {op.label}
        </button>
      ))}
    </div>
  )
}

export default function PopupQuestionarioHospedagemCheck({
  isOpen,
  onClose,
  onPesquisar,
  onLimpar,
  filtroAtivo = false,
  pesquisando = false,
}: Props) {
  const [data, setData] = useState('')
  const [pessoas, setPessoas] = useState('1')
  const [querComodidades, setQuerComodidades] = useState<boolean | null>(null)
  const [comodidades, setComodidades] = useState<string[]>([])
  const [filtrarPreco, setFiltrarPreco] = useState<boolean | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useModalScrollLock(isOpen)

  const hoje = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const grupos = useMemo(() => {
    type Item = (typeof COMODIDADES_FILTRO_CHECK)[number]
    const map = new Map<string, Item[]>()
    for (const item of COMODIDADES_FILTRO_CHECK) {
      const list = map.get(item.grupo) ?? []
      list.push(item)
      map.set(item.grupo, list)
    }
    return [...map.entries()]
  }, [])

  if (!isOpen) return null

  const toggleComodidade = (value: string) => {
    setComodidades((prev) =>
      prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value],
    )
  }

  const handlePesquisar = () => {
    if (!data) {
      setErro('Informe a data da busca.')
      return
    }
    const n = Number(pessoas)
    if (!Number.isFinite(n) || n < 1) {
      setErro('Informe para quantas pessoas.')
      return
    }
    if (querComodidades === null) {
      setErro('Informe se procura comodidades particulares.')
      return
    }
    if (querComodidades && comodidades.length === 0) {
      setErro('Selecione ao menos uma comodidade.')
      return
    }
    if (filtrarPreco === null) {
      setErro('Informe se deseja filtrar por preço.')
      return
    }
    setErro(null)
    onPesquisar({
      data,
      pessoas: Math.floor(n),
      comodidades: querComodidades ? comodidades : [],
      ordenarPorPreco: Boolean(filtrarPreco),
    })
  }

  const labelCls = 'block text-xs font-semibold uppercase tracking-wide text-gray-500'
  const inputCls =
    'mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#0097b2]'

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white shadow-xl"
        data-modal-scroll-lock-scrollable
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="popup-check-hospedagem-titulo"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-2 border-b border-gray-100 bg-white p-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <BotaoInfoPopup texto={TEXTO_INFO} ariaLabel="Informação sobre o questionário" />
              <h2
                id="popup-check-hospedagem-titulo"
                className="text-lg font-bold"
                style={{ color: COR }}
              >
                Procura uma acomodação?
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <label className={labelCls}>
            Para qual data?
            <input
              type="date"
              min={hoje}
              value={data}
              onChange={(e) => setData(e.target.value)}
              className={inputCls}
            />
          </label>

          <label className={labelCls}>
            Para quantas pessoas?
            <input
              type="number"
              min={1}
              step={1}
              value={pessoas}
              onChange={(e) => setPessoas(e.target.value)}
              className={inputCls}
            />
          </label>

          <div>
            <p className={labelCls}>Procura por comodidades com características particulares?</p>
            <SimNao
              value={querComodidades}
              onChange={(v) => {
                setQuerComodidades(v)
                if (!v) setComodidades([])
              }}
            />
          </div>

          {querComodidades === true ? (
            <div className="max-h-56 space-y-3 overflow-y-auto rounded-xl border border-gray-200 bg-[#f5f5f5] p-3">
              {grupos.map(([grupo, itens]) => (
                <div key={grupo}>
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                    {grupo}
                  </p>
                  <ul className="space-y-1.5">
                    {itens.map((op) => {
                      const ativo = comodidades.includes(op.value)
                      return (
                        <li key={op.value}>
                          <button
                            type="button"
                            onClick={() => toggleComodidade(op.value)}
                            className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs ${
                              ativo
                                ? 'border-[#0097b2] bg-[#0097b2]/10 font-semibold'
                                : 'border-gray-200 bg-white'
                            }`}
                          >
                            <span
                              className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                                ativo ? 'border-[#0097b2] bg-[#0097b2]' : 'border-gray-300'
                              }`}
                            >
                              {ativo ? (
                                <Check className="h-2 w-2 text-white" aria-hidden />
                              ) : null}
                            </span>
                            {op.label}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}

          <div>
            <p className={labelCls}>Filtrar acomodações por preço?</p>
            <SimNao value={filtrarPreco} onChange={setFiltrarPreco} />
            {filtrarPreco === true ? (
              <p className="mt-1.5 text-xs text-gray-500">
                Os resultados serão ordenados do menor valor de diária para o maior.
              </p>
            ) : null}
          </div>

          {erro ? <p className="text-sm text-rose-600">{erro}</p> : null}

          <button
            type="button"
            onClick={handlePesquisar}
            disabled={pesquisando}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white disabled:opacity-50"
            style={{ backgroundColor: VERDE }}
          >
            <Search className="h-4 w-4" aria-hidden />
            {pesquisando ? 'Pesquisando…' : 'PESQUISAR'}
          </button>

          {filtroAtivo && onLimpar ? (
            <button
              type="button"
              onClick={() => {
                onLimpar()
                onClose()
              }}
              className="w-full text-center text-sm font-semibold text-gray-600 underline"
            >
              Limpar filtro atual
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
