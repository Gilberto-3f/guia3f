'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Building2, ChevronDown, Search } from 'lucide-react'
import type { EmpresaAdm } from '../../../hooks/useEmpresasAdm'
import type { PeriodoId } from '../../shared/FiltrosPeriodo'
import { FiltroPeriodoCompacto } from '../../shared/FiltroPeriodoCompacto'
import type { Periodo } from '@/app/[locale]/(app-shell)/dashboard/empresa/types/dashboard.types'
import { FunilConversaoAdmEmpresa } from './FunilConversaoAdmEmpresa'
import { ROTULO_SEGUIMENTO_GUIA, normalizarCategoriaEmpresaGuia } from '@/lib/segmentosEmpresaGuia'

function periodoAdmParaFunil(periodo: PeriodoId): Periodo {
  if (periodo === '12m') return '90d'
  return periodo
}

function rotuloCategoria(categoria: string) {
  const norm = normalizarCategoriaEmpresaGuia(categoria)
  if (norm && ROTULO_SEGUIMENTO_GUIA[norm]) return ROTULO_SEGUIMENTO_GUIA[norm]
  return categoria
}

function CardEmpresaFunil({
  emp,
  expandida,
  onToggleFunil,
  periodo,
}: {
  emp: EmpresaAdm
  expandida: boolean
  onToggleFunil: () => void
  periodo: Periodo
}) {
  return (
    <article className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-start gap-3 p-3">
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

      <button
        type="button"
        onClick={onToggleFunil}
        aria-expanded={expandida}
        className="flex w-full items-center justify-between gap-2 border-t border-gray-100 px-3 py-2.5 text-left transition hover:bg-gray-50/80"
      >
        <span className="min-w-0 truncate text-sm text-gray-600">
          {rotuloCategoria(emp.categoria)} · {emp.cidade}
        </span>
        <ChevronDown
          className={['h-5 w-5 shrink-0 text-gray-500 transition-transform', expandida ? 'rotate-180' : ''].join(' ')}
          aria-hidden
        />
      </button>

      {expandida ? (
        <div className="border-t border-gray-100 bg-gray-50/40 pb-2">
          <FunilConversaoAdmEmpresa
            empresaId={emp.id}
            empresaUsuarioId={emp.usuarioId}
            username={emp.username}
            verificado={emp.verificado}
            periodo={periodo}
          />
        </div>
      ) : null}
    </article>
  )
}

export function FunilConversaoGeral({
  busca,
  onBuscaChange,
  empresas,
  loading,
}: {
  busca: string
  onBuscaChange: (v: string) => void
  empresas: EmpresaAdm[]
  loading: boolean
  selecionada?: EmpresaAdm | null
  onSelect?: (e: EmpresaAdm | null) => void
}) {
  const [periodo, setPeriodo] = useState<PeriodoId>('30d')
  const [expandidaId, setExpandidaId] = useState<string | null>(null)
  const periodoFunil = periodoAdmParaFunil(periodo)

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <FiltroPeriodoCompacto value={periodo} onChange={setPeriodo} />
      </div>

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
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : empresas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-10 text-center text-sm text-gray-500">
          {busca.trim().length >= 2
            ? 'Nenhuma empresa encontrada para esta busca.'
            : 'Nenhuma empresa cadastrada na plataforma.'}
        </div>
      ) : (
        <div className="space-y-3">
          {empresas.map((emp) => (
            <CardEmpresaFunil
              key={emp.id}
              emp={emp}
              expandida={expandidaId === emp.id}
              onToggleFunil={() => setExpandidaId((atual) => (atual === emp.id ? null : emp.id))}
              periodo={periodoFunil}
            />
          ))}
        </div>
      )}
    </div>
  )
}
