'use client'

import { useState } from 'react'
import { useDenuncias } from '../../hooks/useDenuncias'
import type { DenunciasFiltros } from '../../types/admin.types'
import CardDenuncia from './CardDenuncia'

export default function ListaDenuncias(filtros: DenunciasFiltros) {
  const [feedback, setFeedback] = useState<string | null>(null)
  const { denuncias, contadores, loading, error, aplicarPenalidade, marcarEmInvestigacao, arquivar, refetch } = useDenuncias(filtros)

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 text-xs text-gray-600 shadow-sm">
        <div className="font-semibold text-gray-900">Resumo por status</div>
        <div className="mt-1 flex flex-wrap gap-3">
          <span>Pendentes: {contadores.pendente}</span>
          <span>Em investigação: {contadores.em_investigacao}</span>
          <span>Encerradas: {contadores.encerrada}</span>
          <span>Arquivadas: {contadores.arquivada}</span>
        </div>
      </div>

      {feedback ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{feedback}</div> : null}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((k) => (
            <div key={k} className="h-28 animate-pulse rounded-2xl bg-gray-100" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Erro ao carregar denúncias: {error.message}
          <button type="button" onClick={() => void refetch()} className="ml-3 rounded-lg bg-rose-600 px-3 py-1 text-xs font-semibold text-white">
            Tentar novamente
          </button>
        </div>
      ) : denuncias.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">Nenhuma denúncia encontrada com os filtros atuais.</div>
      ) : (
        denuncias.map((denuncia) => (
          <CardDenuncia
            key={denuncia.id}
            denuncia={denuncia}
            onMarcarInvestigacao={async () => {
              await marcarEmInvestigacao(denuncia.id)
              setFeedback('Denúncia marcada como em investigação.')
            }}
            onAplicarPenalidade={async (payload) => {
              await aplicarPenalidade({ denuncia_id: denuncia.id, ...payload })
              setFeedback('Penalidade aplicada com sucesso.')
            }}
            onArquivar={async (motivo) => {
              await arquivar(denuncia.id, motivo)
              setFeedback('Denúncia arquivada com sucesso.')
            }}
          />
        ))
      )}
    </div>
  )
}
