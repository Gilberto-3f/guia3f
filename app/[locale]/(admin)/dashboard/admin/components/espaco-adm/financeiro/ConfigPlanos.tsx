'use client'

import { useState } from 'react'
import { useFinanceiroAdm, type Plano } from '../../../hooks/useFinanceiroAdm'

export function ConfigPlanos() {
  const { planos, salvarPlano, isAdminFinanceiro } = useFinanceiroAdm()
  const [editando, setEditando] = useState<Plano | null>(null)
  const [valor, setValor] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  if (!isAdminFinanceiro) {
    return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Apenas financeiro/ADM GERAL podem editar planos.</div>
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {planos.map((p) => {
          const isThis = editando?.id === p.id
          return (
            <div key={p.id} className="rounded-xl border border-gray-200 p-3 text-xs">
              <div className="text-sm font-semibold text-gray-900">{p.nome}</div>
              <div className="mt-1 text-xs text-gray-600">
                Valor atual:{' '}
                <span className="font-semibold">
                  R$ {p.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              {isThis ? (
                <div className="mt-2 space-y-2">
                  <input
                    type="number"
                    className="w-full rounded-lg border border-gray-200 px-2 py-1"
                    value={valor ?? p.valor}
                    onChange={(e) => setValor(Number(e.target.value) || 0)}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditando(null)
                        setValor(null)
                      }}
                      className="flex-1 rounded-lg border border-gray-200 px-2 py-1"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={async () => {
                        setSaving(true)
                        await salvarPlano({ ...p, valor: valor ?? p.valor })
                        setSaving(false)
                        setEditando(null)
                        setValor(null)
                      }}
                      className="flex-1 rounded-lg bg-[#0097b2] px-2 py-1 text-white"
                    >
                      {saving ? 'Salvando...' : 'Salvar'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="mt-3 rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white"
                  onClick={() => setEditando(p)}
                >
                  Editar
                </button>
              )}
            </div>
          )
        })}
    </div>
  )
}

