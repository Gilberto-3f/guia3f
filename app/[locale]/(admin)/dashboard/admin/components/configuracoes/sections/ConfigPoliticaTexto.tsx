'use client'

import { useState } from 'react'
import { Pencil, Save } from 'lucide-react'
import type { ConfigGeral } from '../../../types/admin.types'

export type CampoPolitica = 'politicas_privacidade' | 'termos_uso'

const COR_AZUL = '#0097b2'
const COR_VERDE = '#00D443'

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
  const bloqueado = !editando || !podeEditar
  const salvarDisponivel = editando && podeEditar && !salvando

  const handleSalvar = async () => {
    if (!salvarDisponivel) return
    try {
      await onSalvar()
      setEditando(false)
    } catch {
      /* mensagem tratada no pai */
    }
  }

  return (
    <div className="space-y-3">
      <textarea
        value={localGeral[chave]}
        onChange={(e) => setLocalGeral({ ...localGeral, [chave]: e.target.value })}
        readOnly={bloqueado}
        disabled={!podeEditar && bloqueado}
        rows={12}
        className={`w-full rounded-xl border border-gray-200 p-3 font-mono text-sm transition ${
          bloqueado ? 'cursor-default bg-gray-50 text-gray-700' : 'bg-white text-gray-900'
        }`}
        aria-label="Texto da política"
      />

      {podeEditar ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditando(true)}
            disabled={salvando}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: COR_AZUL }}
          >
            <Pencil className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
            EDITAR
          </button>
          <button
            type="button"
            onClick={() => void handleSalvar()}
            disabled={!salvarDisponivel}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-400"
            style={salvarDisponivel ? { backgroundColor: COR_VERDE } : undefined}
          >
            <Save className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
            {salvando ? 'SALVANDO…' : 'SALVAR'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
