'use client'

import Image from 'next/image'
import { Check, X } from 'lucide-react'
import type { useComissaoOfertaAdm } from '../../../hooks/useComissaoOfertaAdm'
import { listarBeneficiosAtivos, textoValidadeOferta } from '../../../hooks/useComissaoOfertaAdm'

export function AnaliseBeneficios({
  comissao,
}: {
  comissao: ReturnType<typeof useComissaoOfertaAdm>
}) {
  const { ofertas, loading, error, acaoId, refetch, aprovar, reprovar } = comissao

  if (loading) {
    return <p className="py-6 text-center text-sm text-gray-500">Carregando ofertas pendentes…</p>
  }

  if (error) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-rose-600">{error.message}</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="text-sm font-semibold text-[#0097b2] hover:underline"
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  if (ofertas.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-gray-500">
        Nenhuma oferta aguardando análise. Novas propostas aparecem aqui quando as empresas cadastram comissões.
      </p>
    )
  }

  return (
    <ul className="space-y-3">
      {ofertas.map((oferta) => {
        const beneficios = listarBeneficiosAtivos(oferta.beneficios)
        const validade = textoValidadeOferta(oferta)
        const processando = acaoId === oferta.id
        const dia = oferta.createdAt
          ? new Date(oferta.createdAt).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
          : '—'

        return (
          <li key={oferta.id} className="rounded-xl border border-gray-200 bg-gray-50/80 p-3">
            <div className="flex items-start gap-3">
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-gray-200">
                {oferta.empresaFotoUrl ? (
                  <Image src={oferta.empresaFotoUrl} alt="" fill className="object-cover" sizes="44px" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-400">—</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900">{oferta.empresaNome}</p>
                {oferta.empresaUsername ? (
                  <p className="text-xs font-medium text-[#0097b2]">@{oferta.empresaUsername}</p>
                ) : null}
                <p className="mt-0.5 text-[11px] text-gray-500">
                  {oferta.empresaCategoria} · {oferta.empresaCidade}
                </p>
              </div>
            </div>

            <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-900">Comunidade alvo</p>
              <p className="text-sm font-semibold text-gray-900">{oferta.categoriaProfissional}</p>
              <p className="mt-1 text-[11px] text-gray-500">Enviado em {dia}</p>
            </div>

            <div className="mt-3">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Proposta de oferta</p>
              {beneficios.length === 0 ? (
                <p className="mt-1 text-sm text-gray-500">Nenhum benefício ativo na proposta.</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {beneficios.map((b) => (
                    <li key={b.label} className="rounded-md bg-white px-2.5 py-1.5 text-sm">
                      <span className="text-gray-600">{b.label}: </span>
                      <span className="font-semibold text-gray-900">{b.valor}</span>
                    </li>
                  ))}
                </ul>
              )}
              {validade ? <p className="mt-2 text-xs text-amber-800">{validade}</p> : null}
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={processando}
                onClick={() => void aprovar(oferta.id)}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <Check className="h-4 w-4" aria-hidden />
                Aprovar
              </button>
              <button
                type="button"
                disabled={processando}
                onClick={() => void reprovar(oferta.id)}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white py-2 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                <X className="h-4 w-4" aria-hidden />
                Reprovar
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
