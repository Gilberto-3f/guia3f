'use client'

import { useMemo, useState } from 'react'
import { CardPendente, type CadastroPendente } from './CardPendente'
import { useVerificacao } from '../../hooks/useVerificacao'
import type { PendenteEmpresa, PendenteProfissional, PendenteTurista } from '../../types/admin.types'
import {
  mapEmpresaToCadastroPendente,
  mapProfissionalToCadastroPendente,
  mapTuristaToCadastroPendente,
} from './mapCadastroPendente'

export function ListaPendentes({ tipo }: { tipo: 'turistas' | 'profissionais' | 'empresas' }) {
  const [feedback, setFeedback] = useState<string | null>(null)
  const { pendentes, loading, error, aprovar, reprovar, solicitarExclusao } = useVerificacao({
    perfil: tipo,
  })

  const itens = useMemo<CadastroPendente[]>(() => {
    if (loading) return []
    if (tipo === 'turistas') {
      return (pendentes as PendenteTurista[]).map((p) => mapTuristaToCadastroPendente(p))
    }
    if (tipo === 'profissionais') {
      return (pendentes as PendenteProfissional[]).map((p) => mapProfissionalToCadastroPendente(p))
    }
    return (pendentes as PendenteEmpresa[]).map((p) => mapEmpresaToCadastroPendente(p))
  }, [pendentes, tipo, loading])

  return (
    <div className="space-y-3">
      {loading ? <div className="rounded-2xl bg-gray-100 p-4 text-sm text-gray-500">Carregando pendentes...</div> : null}
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <span className="font-semibold">Falha ao carregar pendentes.</span>{' '}
          <span className="whitespace-pre-wrap text-rose-700">{error.message}</span>
        </div>
      ) : null}
      {feedback ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{feedback}</div> : null}

      <div className="space-y-3">
        {itens.map((i) => (
          <CardPendente
            key={i.id}
            item={i}
            tipo={tipo}
            onAprovar={() => {
              void aprovar(i.id, tipo)
                .then(() => setFeedback('Cadastro aprovado com sucesso.'))
                .catch((err: unknown) =>
                  setFeedback(err instanceof Error ? err.message : 'Não foi possível aprovar. Verifique permissões e tente de novo.'),
                )
            }}
            onReprovar={async (motivo) => {
              try {
                await reprovar(i.id, tipo, motivo)
                setFeedback('Cadastro reprovado. O usuário foi notificado do motivo.')
              } catch (err: unknown) {
                setFeedback(err instanceof Error ? err.message : 'Não foi possível reprovar. Tente de novo.')
                throw err
              }
            }}
            onSolicitarExclusao={async (motivo) => {
              try {
                await solicitarExclusao(i.id, tipo, motivo)
                setFeedback('Solicitação de exclusão enviada ao ADM GERAL para conclusão.')
              } catch (err: unknown) {
                setFeedback(err instanceof Error ? err.message : 'Não foi possível solicitar exclusão.')
                throw err
              }
            }}
          />
        ))}
      </div>
    </div>
  )
}
