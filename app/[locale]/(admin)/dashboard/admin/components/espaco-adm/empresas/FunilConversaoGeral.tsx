'use client'

import Image from 'next/image'
import { Building2, MapPin, Search, Star } from 'lucide-react'
import type { EmpresaAdm } from '../../../hooks/useEmpresasAdm'
import { FunilConversaoLista } from './FunilConversaoLista'

export function FunilConversaoGeral({
  busca,
  onBuscaChange,
  empresas,
  loading,
  selecionada,
  onSelect,
}: {
  busca: string
  onBuscaChange: (v: string) => void
  empresas: EmpresaAdm[]
  loading: boolean
  selecionada: EmpresaAdm | null
  onSelect: (e: EmpresaAdm | null) => void
}) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-600">
        Busque e selecione uma empresa para visualizar o funil de conversão individual. Os dados refletem o mesmo
        funil disponível no dashboard da empresa.
      </p>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          aria-hidden
        />
        <input
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 outline-none focus:border-[#0097b2]"
          placeholder="Buscar por nome ou @..."
          value={busca}
          onChange={(e) => onBuscaChange(e.target.value)}
          aria-label="Buscar empresa"
        />
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : empresas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-10 text-center text-sm text-gray-500">
          {busca.trim().length >= 2
            ? 'Nenhuma empresa encontrada para esta busca.'
            : 'Nenhuma empresa cadastrada na plataforma.'}
        </div>
      ) : (
        <div className="grid max-h-[min(24rem,50vh)] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
          {empresas.map((emp) => {
            const ativa = selecionada?.id === emp.id
            return (
              <button
                key={emp.id}
                type="button"
                onClick={() => onSelect(ativa ? null : emp)}
                className={[
                  'rounded-xl border p-3 text-left transition',
                  ativa
                    ? 'border-[#0097b2] bg-[#0097b2]/5 shadow-sm ring-2 ring-[#0097b2]/25'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm',
                ].join(' ')}
              >
                <div className="flex items-start gap-3">
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                    {emp.fotoUrl ? (
                      <Image src={emp.fotoUrl} alt="" fill className="object-cover" sizes="44px" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-gray-400">
                        <Building2 className="h-5 w-5" aria-hidden />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-gray-900">{emp.nome}</p>
                    <p className="truncate text-xs font-medium text-[#0097b2]">@{emp.username}</p>
                  </div>
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-700">
                    <Building2 className="h-3 w-3" aria-hidden />
                    {emp.categoria}
                  </span>
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-700">
                    <MapPin className="h-3 w-3" aria-hidden />
                    {emp.cidade}
                  </span>
                  <span
                    className={[
                      'rounded-full px-2 py-0.5 text-[10px] font-bold',
                      emp.plano === 'Premium' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-700',
                    ].join(' ')}
                  >
                    {emp.plano}
                  </span>
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden />
                    {emp.nota.toFixed(1)}
                  </span>
                  <span
                    className={[
                      'rounded-full px-2 py-0.5 text-[10px] font-bold capitalize',
                      emp.status === 'ativo' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600',
                    ].join(' ')}
                  >
                    {emp.status}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {selecionada ? (
        <div className="rounded-xl border border-[#0097b2]/20 bg-gradient-to-b from-[#0097b2]/5 to-white p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[#0097b2]">Funil selecionado</p>
              <p className="text-base font-bold text-gray-900">{selecionada.nome}</p>
            </div>
            <button
              type="button"
              onClick={() => onSelect(null)}
              className="shrink-0 text-xs font-semibold text-gray-500 hover:text-gray-800"
            >
              Limpar
            </button>
          </div>
          <FunilConversaoLista empresaId={selecionada.id} empresaNome={selecionada.nome} />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
          Selecione uma empresa na grade acima para ver o funil de conversão.
        </div>
      )}
    </div>
  )
}
