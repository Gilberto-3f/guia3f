'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import type { FiltrosVisaoGeral } from '../../types/admin.types'
import { useAdminData } from '../../hooks/useAdminData'
import { GraficoLinha } from './GraficoLinha'
import { GraficoPizza } from './GraficoPizza'
import { GraficoRosca } from './GraficoRosca'
import { GraficoBarras } from './GraficoBarras'

export type VisaoSubabaId = 'turistas' | 'profissionais' | 'empresas'

const opts: { id: VisaoSubabaId; label: string }[] = [
  { id: 'turistas', label: '👥 Turistas' },
  { id: 'profissionais', label: '🚗 Profissionais' },
  { id: 'empresas', label: '🏢 Empresas' },
]

export function SubabasVisao({ value, filtros }: { value: VisaoSubabaId; filtros: FiltrosVisaoGeral }) {
  const router = useRouter()
  const sp = useSearchParams()
  const { crescimento, ativos, novosCadastros, servicosMaisUsados, maisUsadosGuia, profissionaisCidade, profissionaisCategoria, empresasCidade, empresasSegmento, loading, error } =
    useAdminData(value, filtros)

  const set = (next: VisaoSubabaId) => {
    const params = new URLSearchParams(sp.toString())
    params.set('tab', 'visao-geral')
    params.set('sub', next)
    router.replace(`?${params.toString()}`)
  }

  return (
    <div className="min-w-0 flex-1 space-y-4">
      <div className="-mx-1 flex min-w-0 max-w-full flex-nowrap gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin] sm:flex-wrap sm:overflow-visible">
        {opts.map((o) => {
          const active = o.id === value
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => set(o.id)}
              className={[
                'shrink-0 rounded-xl px-3 py-2 text-sm font-semibold whitespace-nowrap transition',
                active ? 'bg-emerald-600 text-white shadow-sm' : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200',
              ].join(' ')}
            >
              {o.label}
            </button>
          )
        })}
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Não foi possível carregar os dados da Visão Geral. Tente novamente em instantes.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GraficoLinha dados={crescimento} loading={loading} title="Crescimento de usuários" />
        <GraficoPizza dados={ativos} loading={loading} title="Ativos no app (48h)" />
        <GraficoRosca dados={novosCadastros} loading={loading} title="Novos cadastros" />

        {value === 'turistas' ? (
          <>
            <GraficoBarras
              dados={servicosMaisUsados}
              loading={loading}
              title="Serviços mais usados"
              emptyMessage="Em breve: estatisticas de uso dos servicos."
            />
            <GraficoBarras
              dados={maisUsadosGuia}
              loading={loading}
              title="Mais usados no Guia"
              emptyMessage="Em breve: categorias mais acessadas no guia."
            />
          </>
        ) : null}

        {value === 'profissionais' ? (
          <>
            <GraficoBarras
              dados={profissionaisCidade}
              loading={loading}
              title="Profissionais por cidade"
              emptyMessage="Em breve: distribuicao geografica dos profissionais."
            />
            <GraficoBarras dados={profissionaisCategoria} loading={loading} title="Profissionais por categoria" />
          </>
        ) : null}

        {value === 'empresas' ? (
          <>
            <GraficoBarras dados={empresasCidade} loading={loading} title="Empresas por cidade" />
            <GraficoBarras dados={empresasSegmento} loading={loading} title="Empresas por segmento" />
          </>
        ) : null}
      </div>
    </div>
  )
}

