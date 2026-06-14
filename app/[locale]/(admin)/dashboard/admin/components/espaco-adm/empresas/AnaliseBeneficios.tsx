'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Archive, Check, Clock, X, type LucideIcon } from 'lucide-react'
import type { useComissaoOfertaAdm } from '../../../hooks/useComissaoOfertaAdm'
import { listarBeneficiosAtivos, textoValidadeOferta } from '../../../hooks/useComissaoOfertaAdm'

const COR_ABA_ATIVA = '#00D443'

type AbaBeneficios = 'pendentes' | 'arquivados'

function AbasBeneficios({
  value,
  onChange,
}: {
  value: AbaBeneficios
  onChange: (v: AbaBeneficios) => void
}) {
  const opcoes: { id: AbaBeneficios; label: string; Icon: LucideIcon }[] = [
    { id: 'pendentes', label: 'Pendentes', Icon: Clock },
    { id: 'arquivados', label: 'Arquivados', Icon: Archive },
  ]

  return (
    <div className="mb-4 flex gap-2" role="tablist" aria-label="Análise de benefícios">
      {opcoes.map((o) => {
        const active = value === o.id
        const Icon = o.Icon
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.id)}
            className={[
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 transition',
              active
                ? 'text-base font-bold text-white shadow-sm'
                : 'border border-gray-300 bg-white text-sm font-normal text-gray-500 hover:bg-gray-50',
            ].join(' ')}
            style={active ? { backgroundColor: COR_ABA_ATIVA } : undefined}
          >
            <Icon
              className={['shrink-0', active ? 'h-5 w-5 text-white' : 'h-4 w-4 text-gray-500'].join(' ')}
              strokeWidth={2.25}
              aria-hidden
            />
            <span>{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function OfertaCard({
  oferta,
  modo,
  processando,
  onAprovar,
  onReprovar,
}: {
  oferta: ReturnType<typeof useComissaoOfertaAdm>['ofertas'][number]
  modo: AbaBeneficios
  processando: boolean
  onAprovar?: () => void
  onReprovar?: () => void
}) {
  const beneficios = listarBeneficiosAtivos(oferta.beneficios)
  const validade = textoValidadeOferta(oferta)
  const dia = oferta.createdAt
    ? new Date(oferta.createdAt).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'

  const statusLabel =
    oferta.status === 'aprovada' ? 'Aprovada' : oferta.status === 'reprovada' ? 'Reprovada' : 'Pendente'
  const statusCls =
    oferta.status === 'aprovada'
      ? 'bg-emerald-100 text-emerald-800'
      : oferta.status === 'reprovada'
        ? 'bg-red-100 text-red-800'
        : 'bg-amber-100 text-amber-800'

  return (
    <li className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-gray-100">
          {oferta.empresaFotoUrl ? (
            <Image src={oferta.empresaFotoUrl} alt="" fill className="object-cover" sizes="48px" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">—</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-semibold text-gray-900">{oferta.empresaNome}</p>
              {oferta.empresaUsername ? (
                <p className="text-xs font-medium text-[#0097b2]">@{oferta.empresaUsername}</p>
              ) : null}
              <p className="mt-0.5 text-[11px] text-gray-500">
                {oferta.empresaCategoria} · {oferta.empresaCidade}
              </p>
            </div>
            {modo === 'arquivados' ? (
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${statusCls}`}>
                {statusLabel}
              </span>
            ) : null}
          </div>
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
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {beneficios.map((b) => (
              <li key={b.label} className="rounded-md bg-gray-50 px-2.5 py-1.5 text-sm">
                <span className="text-gray-600">{b.label}: </span>
                <span className="font-semibold text-gray-900">{b.valor}</span>
              </li>
            ))}
          </ul>
        )}
        {validade ? <p className="mt-2 text-xs text-amber-800">{validade}</p> : null}
      </div>

      {modo === 'pendentes' && onAprovar && onReprovar ? (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={processando}
            onClick={onAprovar}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Check className="h-4 w-4" aria-hidden />
            Aprovar
          </button>
          <button
            type="button"
            disabled={processando}
            onClick={onReprovar}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white py-2 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            <X className="h-4 w-4" aria-hidden />
            Reprovar
          </button>
        </div>
      ) : null}
    </li>
  )
}

export function AnaliseBeneficios({
  comissaoPendentes,
  comissaoArquivados,
}: {
  comissaoPendentes: ReturnType<typeof useComissaoOfertaAdm>
  comissaoArquivados: ReturnType<typeof useComissaoOfertaAdm>
}) {
  const [aba, setAba] = useState<AbaBeneficios>('pendentes')
  const comissao = aba === 'pendentes' ? comissaoPendentes : comissaoArquivados
  const { ofertas, loading, error, acaoId, refetch, aprovar, reprovar } = comissao

  return (
    <>
      <AbasBeneficios value={aba} onChange={setAba} />

      {loading ? (
        <p className="py-6 text-center text-sm text-gray-500">
          {aba === 'pendentes' ? 'Carregando ofertas pendentes…' : 'Carregando histórico…'}
        </p>
      ) : error ? (
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
      ) : ofertas.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">
          {aba === 'pendentes'
            ? 'Nenhuma oferta aguardando análise. Novas propostas aparecem aqui quando as empresas cadastram comissões.'
            : 'Nenhuma oferta arquivada ainda. O histórico de aprovações e reprovações aparecerá aqui.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {ofertas.map((oferta) => (
            <OfertaCard
              key={oferta.id}
              oferta={oferta}
              modo={aba}
              processando={acaoId === oferta.id}
              onAprovar={aba === 'pendentes' ? () => void aprovar(oferta.id) : undefined}
              onReprovar={aba === 'pendentes' ? () => void reprovar(oferta.id) : undefined}
            />
          ))}
        </ul>
      )}
    </>
  )
}
