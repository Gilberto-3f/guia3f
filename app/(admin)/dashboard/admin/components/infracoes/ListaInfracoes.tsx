'use client'

import { useState } from 'react'
import type { Infracao } from '../../hooks/useInfracoes'
import FormInfracao from './FormInfracao'

export default function ListaInfracoes({
  infracoes,
  onSave,
}: {
  infracoes: Infracao[]
  onSave: (payload: Partial<Infracao>) => Promise<void>
}) {
  const [editando, setEditando] = useState<string | null>(null)

  return (
    <div className="space-y-2">
      {infracoes.map((i) => (
        <div key={i.id} className="rounded-xl border border-gray-200 bg-white p-3">
          {editando === i.id ? (
            <FormInfracao
              inicial={i}
              onCancel={() => setEditando(null)}
              onSubmit={async (payload) => {
                await onSave({ ...payload, id: i.id })
                setEditando(null)
              }}
            />
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-gray-900">{i.descricao}</div>
                <div className="text-xs text-gray-600">
                  {i.tipo} · {i.categoria} · {i.penalidade_padrao}
                  {i.dias_suspensao_padrao ? ` (${i.dias_suspensao_padrao}d)` : ''}
                </div>
              </div>
              <button type="button" onClick={() => setEditando(i.id)} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700">
                Editar
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
