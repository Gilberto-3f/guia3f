'use client'

import { useMemo, useState } from 'react'
import { Pencil, Plus, Save, Trash2 } from 'lucide-react'
import {
  criarRegraEcossistemaVazia,
  parseRegrasEcossistema,
  serializeRegrasEcossistema,
  type RegraEcossistema,
} from '@/lib/regrasEcossistema'
import type { ConfigGeral } from '../../../types/admin.types'

const COR_AZUL = '#0097b2'
const COR_VERDE = '#00D443'

function CardRegra({
  regra,
  podeEditar,
  salvando,
  onChange,
  onSalvar,
  onRemover,
}: {
  regra: RegraEcossistema
  podeEditar: boolean
  salvando: boolean
  onChange: (next: RegraEcossistema) => void
  onSalvar: () => Promise<void>
  onRemover: () => void
}) {
  const [editando, setEditando] = useState(() => !regra.texto.trim())
  const bloqueado = !editando || !podeEditar
  const salvarDisponivel = editando && podeEditar && !salvando

  const handleSalvar = async () => {
    if (!salvarDisponivel) return
    try {
      await onSalvar()
      setEditando(false)
    } catch {
      /* pai */
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-[#f5f5f5] p-3">
      <input
        type="text"
        value={regra.titulo}
        onChange={(e) => onChange({ ...regra, titulo: e.target.value })}
        readOnly={bloqueado}
        placeholder="Título da regra"
        className={`w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold transition ${
          bloqueado ? 'cursor-default bg-gray-100 text-gray-700' : 'bg-white text-gray-900'
        }`}
        aria-label="Título da regra"
      />
      <textarea
        value={regra.texto}
        onChange={(e) => onChange({ ...regra, texto: e.target.value })}
        readOnly={bloqueado}
        rows={6}
        placeholder="Texto da regra"
        className={`w-full rounded-lg border border-gray-200 p-3 text-sm transition ${
          bloqueado ? 'cursor-default bg-gray-100 text-gray-700' : 'bg-white text-gray-900'
        }`}
        aria-label="Texto da regra"
      />

      {podeEditar ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setEditando(true)}
            disabled={salvando}
            className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: COR_AZUL }}
          >
            <Pencil className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
            EDITAR
          </button>
          <button
            type="button"
            onClick={() => void handleSalvar()}
            disabled={!salvarDisponivel}
            className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-400"
            style={salvarDisponivel ? { backgroundColor: COR_VERDE } : undefined}
          >
            <Save className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
            {salvando ? 'SALVANDO…' : 'SALVAR'}
          </button>
          <button
            type="button"
            onClick={onRemover}
            disabled={salvando}
            className="inline-flex items-center justify-center rounded-xl bg-white px-3 py-2.5 text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50 disabled:opacity-50"
            aria-label="Remover regra"
            title="Remover"
          >
            <Trash2 className="h-4 w-4" strokeWidth={2.25} aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  )
}

export function ConfigRegrasEcossistema({
  localGeral,
  setLocalGeral,
  podeEditar,
  salvando,
  onSalvar,
}: {
  localGeral: ConfigGeral
  setLocalGeral: (next: ConfigGeral) => void
  podeEditar: boolean
  salvando: boolean
  onSalvar: (override?: ConfigGeral) => Promise<void>
}) {
  const regras = useMemo(
    () => parseRegrasEcossistema(localGeral.regras_ecossistema),
    [localGeral.regras_ecossistema]
  )

  const aplicar = (next: RegraEcossistema[]): ConfigGeral => {
    const updated = {
      ...localGeral,
      regras_ecossistema: serializeRegrasEcossistema(next),
    }
    setLocalGeral(updated)
    return updated
  }

  const criar = () => {
    aplicar([...regras, criarRegraEcossistemaVazia(regras.length + 1)])
  }

  return (
    <div className="space-y-3">
      {podeEditar ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={criar}
            disabled={salvando}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: COR_AZUL }}
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
            Criar
          </button>
        </div>
      ) : null}

      {regras.length === 0 ? (
        <p className="text-center text-sm text-gray-500">Nenhuma regra criada ainda.</p>
      ) : (
        <div className="space-y-3">
          {regras.map((regra, index) => (
            <CardRegra
              key={regra.id}
              regra={regra}
              podeEditar={podeEditar}
              salvando={salvando}
              onChange={(next) => {
                const copia = [...regras]
                copia[index] = next
                aplicar(copia)
              }}
              onSalvar={async () => {
                await onSalvar()
              }}
              onRemover={() => {
                const updated = aplicar(regras.filter((r) => r.id !== regra.id))
                void onSalvar(updated)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
