'use client'

import { useState } from 'react'
import { useInfracoes } from '../../hooks/useInfracoes'
import FormInfracao from './FormInfracao'
import ListaInfracoes from './ListaInfracoes'
import TabelaPenalidades from './TabelaPenalidades'

export default function ConfigInfracoes() {
  const { infracoes, loading, error, isAdminGeral, upsertInfracao } = useInfracoes()
  const [mostrarForm, setMostrarForm] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  if (!isAdminGeral) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Apenas ADM GERAL pode configurar infrações.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold text-gray-900">Configuração de infrações</div>
        <button type="button" onClick={() => setMostrarForm((v) => !v)} className="rounded-lg bg-[#0097b2] px-3 py-2 text-xs font-semibold text-white">
          {mostrarForm ? 'Fechar cadastro' : 'Nova infração'}
        </button>
      </div>

      {feedback ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-700">{feedback}</div> : null}
      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">{error.message}</div> : null}

      {mostrarForm ? (
        <FormInfracao
          onSubmit={async (payload) => {
            await upsertInfracao(payload)
            setFeedback('Infração salva com sucesso.')
            setMostrarForm(false)
          }}
          onCancel={() => setMostrarForm(false)}
        />
      ) : null}

      {loading ? (
        <div className="h-24 animate-pulse rounded-xl bg-gray-100" />
      ) : (
        <>
          <TabelaPenalidades infracoes={infracoes} />
          <ListaInfracoes
            infracoes={infracoes}
            onSave={async (payload) => {
              await upsertInfracao(payload)
              setFeedback('Infração atualizada com sucesso.')
            }}
          />
        </>
      )}
    </div>
  )
}
