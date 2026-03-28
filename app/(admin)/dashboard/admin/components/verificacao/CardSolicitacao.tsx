'use client'

import type { SolicitacaoAcesso } from '../../types/admin.types'

export default function CardSolicitacao({
  solicitacao,
  onAprovar,
  onRecusar,
  onRevogar,
}: {
  solicitacao: SolicitacaoAcesso
  onAprovar: () => void
  onRecusar: () => void
  onRevogar?: () => void
}) {
  const statusClass =
    solicitacao.status === 'pendente'
      ? 'bg-amber-100 text-amber-800'
      : solicitacao.status === 'aprovado'
        ? 'bg-emerald-100 text-emerald-800'
        : solicitacao.status === 'recusado'
          ? 'bg-rose-100 text-rose-800'
          : solicitacao.status === 'revogado'
            ? 'bg-gray-100 text-gray-800'
            : 'bg-orange-100 text-orange-800'

  const statusLabel =
    solicitacao.status === 'pendente'
      ? 'Pendente'
      : solicitacao.status === 'aprovado'
        ? 'Aprovado'
        : solicitacao.status === 'recusado'
          ? 'Recusado'
          : solicitacao.status === 'revogado'
            ? 'Revogado'
            : 'Expirado'
  const isExpiradoVisual =
    solicitacao.status === 'expirado' ||
    (solicitacao.status === 'aprovado' &&
      Boolean(solicitacao.conceder_acesso_ate) &&
      new Date(String(solicitacao.conceder_acesso_ate)) < new Date())

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2">
            <div className="font-semibold text-gray-900">
              {solicitacao.perfil_nome || '-'} (@{solicitacao.perfil_username || '-'})
            </div>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass}`}>{statusLabel}</span>
          </div>
          <div className="text-gray-600">Tipo: {solicitacao.perfil_tipo}</div>
          <div className="text-gray-600">Solicitante: {solicitacao.solicitante_nome || '-'} ({solicitacao.solicitante_email || '-'})</div>
          <div className="text-gray-600">Data: {new Date(solicitacao.created_at).toLocaleDateString('pt-BR')}</div>
          {solicitacao.motivo ? <div className="text-gray-600">Motivo: "{solicitacao.motivo}"</div> : null}
          {solicitacao.status === 'aprovado' && solicitacao.aprovado_em ? (
            <div className="text-xs text-emerald-700">
              Aprovado por {solicitacao.aprovado_por_email ?? '-'} em {new Date(solicitacao.aprovado_em).toLocaleString('pt-BR')}
            </div>
          ) : null}
          {solicitacao.status === 'recusado' && solicitacao.recusado_em ? (
            <div className="text-xs text-rose-700">
              Recusado por {solicitacao.recusado_por_email ?? '-'} em {new Date(solicitacao.recusado_em).toLocaleString('pt-BR')}
            </div>
          ) : null}
          {solicitacao.conceder_acesso_ate && solicitacao.status === 'aprovado' ? (
            <div className="text-xs text-sky-700">
              Acesso válido até {new Date(solicitacao.conceder_acesso_ate).toLocaleString('pt-BR')}
              {isExpiradoVisual ? ' (expirado)' : ''}
            </div>
          ) : null}
          {solicitacao.status === 'revogado' ? (
            <div className="text-xs text-gray-600">
              Revogado por {solicitacao.revogado_por_email ?? '-'} {solicitacao.revogado_em ? `em ${new Date(solicitacao.revogado_em).toLocaleString('pt-BR')}` : ''}
              {solicitacao.motivo_revogacao ? ` - Motivo: ${solicitacao.motivo_revogacao}` : ''}
            </div>
          ) : null}
          {isExpiradoVisual ? (
            <div className="text-xs font-semibold text-orange-700">Indicador: acesso expirado</div>
          ) : null}
        </div>

        {solicitacao.status === 'pendente' ? (
          <div className="flex items-center gap-2">
            <button type="button" onClick={onAprovar} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700">
              Aprovar
            </button>
            <button type="button" onClick={onRecusar} className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700">
              Recusar
            </button>
          </div>
        ) : null}

        {solicitacao.status === 'aprovado' && onRevogar ? (
          <button type="button" onClick={onRevogar} className="rounded-lg bg-gray-700 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-800">
            Revogar acesso
          </button>
        ) : null}
      </div>
    </div>
  )
}
