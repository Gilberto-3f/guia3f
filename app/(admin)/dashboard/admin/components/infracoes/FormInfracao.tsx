'use client'

import { useState } from 'react'
import type { Infracao } from '../../hooks/useInfracoes'

const EMPTY: Omit<Infracao, 'id'> = {
  tipo: 'leve',
  categoria: 'todos',
  descricao: '',
  penalidade_padrao: 'advertencia',
  dias_suspensao_padrao: null,
  alerta_preventivo: false,
  horas_alerta: 24,
  restricao_especifica: {},
}

export default function FormInfracao({
  inicial,
  onSubmit,
  onCancel,
}: {
  inicial?: Infracao | null
  onSubmit: (payload: Partial<Infracao>) => Promise<void>
  onCancel?: () => void
}) {
  const [form, setForm] = useState<Partial<Infracao>>(inicial ?? EMPTY)
  const [saving, setSaving] = useState(false)

  return (
    <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-4">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <select value={form.tipo ?? 'leve'} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as Infracao['tipo'] }))} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
          <option value="leve">Leve</option>
          <option value="media">Média</option>
          <option value="grave">Grave</option>
          <option value="gravissima">Gravíssima</option>
        </select>
        <select value={form.categoria ?? 'todos'} onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value as Infracao['categoria'] }))} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
          <option value="todos">Todos</option>
          <option value="turista">Turista</option>
          <option value="profissional">Profissional</option>
          <option value="empresa">Empresa</option>
        </select>
        <select value={form.penalidade_padrao ?? 'advertencia'} onChange={(e) => setForm((f) => ({ ...f, penalidade_padrao: e.target.value as Infracao['penalidade_padrao'] }))} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
          <option value="advertencia">Advertência</option>
          <option value="suspensao">Suspensão</option>
          <option value="banimento">Banimento</option>
        </select>
      </div>
      <input
        value={form.descricao ?? ''}
        onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
        placeholder="Descrição da infração"
      />
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <input
          type="number"
          value={form.dias_suspensao_padrao ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, dias_suspensao_padrao: e.target.value ? Number(e.target.value) : null }))}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          placeholder="Dias suspensão padrão"
        />
        <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(form.alerta_preventivo)}
            onChange={(e) => setForm((f) => ({ ...f, alerta_preventivo: e.target.checked }))}
          />
          Alerta preventivo
        </label>
        <input
          type="number"
          value={form.horas_alerta ?? 24}
          onChange={(e) => setForm((f) => ({ ...f, horas_alerta: Number(e.target.value) || 24 }))}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          placeholder="Horas alerta"
        />
      </div>
      <div className="flex gap-2">
        {onCancel ? (
          <button type="button" onClick={onCancel} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700">
            Cancelar
          </button>
        ) : null}
        <button
          type="button"
          disabled={saving}
          onClick={async () => {
            setSaving(true)
            try {
              await onSubmit(form)
            } finally {
              setSaving(false)
            }
          }}
          className="rounded-lg bg-[#0097b2] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Salvando...' : 'Salvar infração'}
        </button>
      </div>
    </div>
  )
}
