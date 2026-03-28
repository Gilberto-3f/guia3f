'use client'

import { useState } from 'react'
import type { Denuncia } from '../../types/admin.types'
import AcoesDenuncia from './AcoesDenuncia'
import HistoricoUsuario from './HistoricoUsuario'
import ModalVerDenuncia from './ModalVerDenuncia'

export default function CardDenuncia({
  denuncia,
  onMarcarInvestigacao,
  onAplicarPenalidade,
  onArquivar,
}: {
  denuncia: Denuncia
  onMarcarInvestigacao: () => Promise<void>
  onAplicarPenalidade: (payload: { acao: 'advertir' | 'suspender' | 'banir'; suspensao_dias?: number; motivo: string }) => Promise<void>
  onArquivar: (motivo: string) => Promise<void>
}) {
  const [verOpen, setVerOpen] = useState(false)
  const [acoesOpen, setAcoesOpen] = useState(false)

  const statusClass =
    denuncia.status === 'pendente'
      ? 'bg-red-100 text-red-800'
      : denuncia.status === 'em_investigacao'
        ? 'bg-yellow-100 text-yellow-800'
        : denuncia.status === 'encerrada'
          ? 'bg-emerald-100 text-emerald-800'
          : 'bg-gray-100 text-gray-800'

  const gravidadeClass =
    denuncia.gravidade === 'grave' ? 'text-red-700' : denuncia.gravidade === 'media' ? 'text-yellow-700' : 'text-emerald-700'

  return (
    <>
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-gray-500">
              <span className={`rounded-full px-2 py-0.5 ${statusClass}`}>{denuncia.status.replace('_', ' ')}</span> ·{' '}
              {new Date(denuncia.created_at).toLocaleString('pt-BR')}
            </div>
            <div className="mt-1 text-sm font-bold text-gray-900">
              👤 {denuncia.denunciante_nome || denuncia.denunciante_email} → 🎯 {denuncia.denunciado_nome} (@{denuncia.denunciado_username})
            </div>
            <div className="mt-2 text-sm text-gray-700">{denuncia.motivo}</div>
            {denuncia.descricao ? <div className="mt-1 line-clamp-2 text-sm text-gray-600">{denuncia.descricao}</div> : null}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
              <span className={gravidadeClass}>Gravidade: {denuncia.gravidade || 'não definida'}</span>
              <span className="text-gray-600">Evidências: {denuncia.evidencias.length}</span>
              {denuncia.responsavel_email ? <span className="text-gray-600">Responsável: @{denuncia.responsavel_email.split('@')[0]}</span> : null}
              {denuncia.prazo_analise_ate ? (
                <span className={denuncia.prazo_estourado ? 'font-semibold text-red-700' : 'text-gray-600'}>
                  Prazo análise: {new Date(denuncia.prazo_analise_ate).toLocaleDateString('pt-BR')}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={() => setVerOpen(true)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">
              Ver
            </button>
            <button type="button" onClick={() => setAcoesOpen(true)} className="rounded-lg bg-[#0097b2] px-3 py-2 text-xs font-semibold text-white hover:bg-[#007a91]">
              Ações
            </button>
          </div>
        </div>
        <div className="mt-3">
          <HistoricoUsuario totalAnteriores={denuncia.total_denuncias_anteriores ?? 0} />
        </div>
      </div>

      <ModalVerDenuncia aberto={verOpen} onClose={() => setVerOpen(false)} denuncia={denuncia} />
      <AcoesDenuncia
        aberto={acoesOpen}
        onClose={() => setAcoesOpen(false)}
        onMarcarInvestigacao={onMarcarInvestigacao}
        onAplicarPenalidade={onAplicarPenalidade}
        onArquivar={onArquivar}
      />
    </>
  )
}

