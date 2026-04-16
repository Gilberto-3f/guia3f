'use client'

import type { FiltrosVisaoGeral } from '../../types/admin.types'
import type { VisaoSubabaId } from './SubabasVisaoNav'
import { useAdminData } from '../../hooks/useAdminData'
import { GraficoLinha } from './GraficoLinha'
import { GraficoPizza } from './GraficoPizza'
import { GraficoRosca } from './GraficoRosca'
import { GraficoBarras } from './GraficoBarras'

export function VisaoGeralGraficos({ value, filtros }: { value: VisaoSubabaId; filtros: FiltrosVisaoGeral }) {
  const {
    crescimento,
    ativos,
    novosCadastros,
    servicosMaisUsados,
    maisUsadosGuia,
    profissionaisCidade,
    profissionaisCategoria,
    empresasCidade,
    empresasSegmento,
    loading,
    error,
  } = useAdminData(value, filtros)

  return (
    <div className="min-w-0 space-y-4">
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
