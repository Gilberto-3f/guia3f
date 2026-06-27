'use client'

import { useState } from 'react'
import type { ConfigGeral } from '../../../types/admin.types'

export type CampoPolitica = 'politicas_privacidade' | 'termos_uso' | 'regras_ecossistema'

export function ConfigPoliticaTexto({
  chave,
  localGeral,
  setLocalGeral,
  podeEditar,
  salvando,
  onSalvar,
}: {
  chave: CampoPolitica
  localGeral: ConfigGeral
  setLocalGeral: (next: ConfigGeral) => void
  podeEditar: boolean
  salvando: boolean
  onSalvar: () => Promise<void>
}) {
  const [editando, setEditando] = useState(false)

  return (
    <div>
      {editando && podeEditar ? (
        <div className="space-y-3">
          <textarea
            value={localGeral[chave]}
            onChange={(e) => setLocalGeral({ ...localGeral, [chave]: e.target.value })}
            className="w-full rounded-xl border border-gray-200 p-3 font-mono text-sm"
            rows={12}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditando(false)}
              className="rounded-xl bg-gray-200 px-4 py-2 text-sm font-semibold"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void onSalvar().then(() => setEditando(false))}
              disabled={salvando}
              className="rounded-xl bg-[#0097b2] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      ) : (
        <>
          {podeEditar ? (
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                onClick={() => setEditando(true)}
                className="rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white"
              >
                Editar
              </button>
            </div>
          ) : null}
          <pre className="whitespace-pre-wrap rounded-xl bg-gray-50 p-4 font-sans text-sm text-gray-700">
            {localGeral[chave] || '(nenhum texto definido)'}
          </pre>
        </>
      )}
    </div>
  )
}
