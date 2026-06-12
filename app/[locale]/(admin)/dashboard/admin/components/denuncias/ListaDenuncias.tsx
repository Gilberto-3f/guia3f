'use client'

import { useState } from 'react'
import { useDenuncias } from '../../hooks/useDenuncias'
import type { DenunciasFiltros, MedidaDenunciaTipo } from '../../types/admin.types'
import CardDenuncia from './CardDenuncia'

export default function ListaDenuncias(filtros: DenunciasFiltros) {
  const [feedback, setFeedback] = useState<string | null>(null)
  const { denuncias, contadores, loading, error, aplicarMedida, marcarEmInvestigacao, arquivar, definirGravidade, refetch } =
    useDenuncias(filtros)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="font-bold text-red-600">Pendentes: {contadores.pendente}</span>
        <span className="font-bold text-[#0097b2]">Em investigação: {contadores.em_investigacao}</span>
      </div>

      {feedback ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{feedback}</div>
      ) : null}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((k) => (
            <div key={k} className="h-28 animate-pulse rounded-2xl bg-gray-100" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Erro ao carregar denúncias: {error.message}
          <button
            type="button"
            onClick={() => void refetch()}
            className="ml-3 rounded-lg bg-rose-600 px-3 py-1 text-xs font-semibold text-white"
          >
            Tentar novamente
          </button>
        </div>
      ) : denuncias.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
          Nenhuma denúncia encontrada.
        </div>
      ) : (
        denuncias.map((denuncia) => (
          <CardDenuncia
            key={denuncia.id}
            denuncia={denuncia}
            onAssumir={async () => {
              if (denuncia.status === 'pendente') {
                await marcarEmInvestigacao(denuncia.id)
              }
            }}
            onAplicarMedida={async (medida: MedidaDenunciaTipo, texto?: string) => {
              await aplicarMedida({ denuncia_id: denuncia.id, medida, texto })
              setFeedback('Medida aplicada com sucesso.')
            }}
            onArquivar={async () => {
              await arquivar(denuncia.id)
              setFeedback('Denúncia arquivada na auditoria.')
            }}
            onGravidadeChange={async (gravidade) => {
              await definirGravidade(denuncia.id, gravidade)
            }}
          />
        ))
      )}
    </div>
  )
}
