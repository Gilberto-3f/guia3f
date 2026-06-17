'use client'

import { useState } from 'react'
import { DollarSign, MoreVertical } from 'lucide-react'
import {
  CORES_PLANO,
  SERVICOS_PLANO_EMPRESA,
  corPlanoHex,
  type PlanoCorId,
  type ServicoPlanoId,
} from '@/lib/planosEmpresaCatalogo'
import type { PlanoFormInput } from '../../../hooks/useFinanceiroAdm'
import { ModalDegustacao } from './ModalDegustacao'

const COR_CONFIRMAR = '#00D443'
const MAX_DESCRICAO = 1500

export function planoFormVazio(): PlanoFormInput {
  return {
    titulo: '',
    cor: 'azul',
    descricao: '',
    servicos: [],
    precoMensal: 0,
    precoTrimestral: 0,
    precoAnual: 0,
  }
}

export function CardEditarPlano({
  form,
  onChange,
  onConfirmar,
  onCancelar,
  salvando,
  modo,
}: {
  form: PlanoFormInput
  onChange: (next: PlanoFormInput) => void
  onConfirmar: () => void
  onCancelar: () => void
  salvando: boolean
  modo: 'novo' | 'editar'
}) {
  const corHex = corPlanoHex(form.cor)
  const [degustacaoAberta, setDegustacaoAberta] = useState(false)

  const toggleServico = (id: ServicoPlanoId) => {
    const set = new Set(form.servicos)
    if (set.has(id)) set.delete(id)
    else set.add(id)
    onChange({ ...form, servicos: [...set] })
  }

  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-2 border-b border-gray-100 pb-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
          style={{ backgroundColor: corHex }}
          aria-hidden
        >
          <DollarSign className="h-5 w-5" strokeWidth={2.25} />
        </span>
        <div className="min-w-0 flex-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Título do plano</label>
          <input
            type="text"
            value={form.titulo}
            onChange={(e) => onChange({ ...form, titulo: e.target.value.slice(0, 80) })}
            placeholder="Ex.: Plano Prata"
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-900 outline-none focus:border-[#0097b2]"
          />
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Paleta de cor do plano</p>
        <div className="mt-2 flex flex-wrap gap-3">
          {CORES_PLANO.map((c) => {
            const active = form.cor === c.id
            return (
              <button
                key={c.id}
                type="button"
                title={c.label}
                aria-label={c.label}
                aria-pressed={active}
                onClick={() => onChange({ ...form, cor: c.id })}
                className={[
                  'h-10 w-10 rounded-lg border-2 transition',
                  active ? 'scale-105 ring-2 ring-offset-2' : 'border-gray-200 hover:scale-105',
                ].join(' ')}
                style={{
                  backgroundColor: c.hex,
                  ...(active ? { borderColor: c.hex, boxShadow: `0 0 0 2px white, 0 0 0 4px ${c.hex}` } : {}),
                }}
              />
            )
          })}
        </div>
        <p className="mt-1.5 text-[11px] text-gray-500">O card permanece com fundo branco; a cor destaca título, ícone e detalhes.</p>
      </div>

      <div className="mt-4">
        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Descrição do plano ({form.descricao.length}/{MAX_DESCRICAO})
        </label>
        <textarea
          value={form.descricao}
          onChange={(e) => onChange({ ...form, descricao: e.target.value.slice(0, MAX_DESCRICAO) })}
          rows={4}
          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:border-[#0097b2]"
          placeholder="Descreva o que este plano oferece à empresa…"
        />
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Cadastro de serviços</p>
        <p className="mt-0.5 text-[11px] text-gray-500">Selecione os serviços liberados para empresas neste plano.</p>
        <ul className="mt-2 max-h-56 space-y-2 overflow-y-auto rounded-lg border border-gray-100 bg-gray-50/80 p-2">
          {SERVICOS_PLANO_EMPRESA.map((s) => {
            const checked = form.servicos.includes(s.id)
            return (
              <li key={s.id}>
                <label className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 hover:bg-white">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleServico(s.id)}
                    className="mt-1 shrink-0"
                  />
                  <span className="text-xs leading-snug text-gray-700">{s.label}</span>
                </label>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Modalidades</p>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(
            [
              { key: 'precoMensal' as const, label: 'Mensal' },
              { key: 'precoTrimestral' as const, label: 'Trimestral' },
              { key: 'precoAnual' as const, label: 'Anual' },
            ] as const
          ).map((m) => (
            <label key={m.key} className="text-xs font-medium text-gray-700">
              {m.label}
              <div className="relative mt-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">R$</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form[m.key] || ''}
                  onChange={(e) => onChange({ ...form, [m.key]: Number(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-2 text-sm outline-none focus:border-[#0097b2]"
                />
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-center gap-2">
        <button
          type="button"
          disabled={salvando || !form.titulo.trim()}
          onClick={onConfirmar}
          className="min-w-[7.5rem] flex-1 max-w-[10rem] rounded-xl py-3 text-sm font-bold uppercase tracking-wide text-white disabled:opacity-50"
          style={{ backgroundColor: COR_CONFIRMAR }}
        >
          {salvando ? 'Salvando…' : 'Confirmar'}
        </button>
        <button
          type="button"
          disabled={salvando}
          onClick={onCancelar}
          className="min-w-[7.5rem] flex-1 max-w-[10rem] rounded-xl border border-gray-300 bg-white py-3 text-sm font-bold uppercase tracking-wide text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => setDegustacaoAberta(true)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
          aria-label="Degustação"
          title="Degustação"
        >
          <MoreVertical className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <ModalDegustacao aberto={degustacaoAberta} onFechar={() => setDegustacaoAberta(false)} />
    </article>
  )
}
