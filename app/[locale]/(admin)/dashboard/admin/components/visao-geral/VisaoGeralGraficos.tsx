'use client'

import type { FiltrosVisaoGeral, PerfilVisaoGeral } from '../../types/admin.types'
import { useAdminData } from '../../hooks/useAdminData'
import { GraficoLinha } from './GraficoLinha'
import { GraficoBarras } from './GraficoBarras'
import GraficoPizzaMercado from '@/app/[locale]/(app-shell)/dashboard/empresa/components/estatisticas-mercado/GraficoPizza'

const TITULOS_PERFIL: Record<PerfilVisaoGeral, string> = {
  turistas: 'Turistas',
  profissionais: 'Profissionais',
  empresas: 'Empresas',
}

export function VisaoGeralGraficos({
  perfil,
  filtros,
}: {
  perfil: PerfilVisaoGeral
  filtros: FiltrosVisaoGeral
}) {
  const {
    crescimento,
    ativos,
    seguimentosGuia,
    mobilidadeCategorias,
    profissionaisPorCategoria,
    profissionaisPorCidade,
    empresasCidade,
    empresasSegmento,
    loading,
    error,
  } = useAdminData(perfil, filtros)

  const tituloPerfil = TITULOS_PERFIL[perfil]

  return (
    <div className="min-w-0 space-y-4">
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Não foi possível carregar os dados da Visão Geral. Tente novamente em instantes.
        </div>
      ) : null}

      <h2 className="text-sm font-bold uppercase tracking-wide text-[#0097b2] sm:text-base">{tituloPerfil}</h2>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GraficoLinha dados={crescimento} loading={loading} title="Crescimento de usuários" />

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-bold text-gray-900">Ativos no app</h3>
          {loading ? (
            <div className="h-48 animate-pulse rounded-xl bg-gray-100" />
          ) : (
            <GraficoPizzaMercado
              dados={ativos ?? []}
              titulo=""
              semTitulo
              embed
              mostrarComZero
            />
          )}
        </div>

        {perfil === 'turistas' ? (
          <>
            <GraficoBarras
              dados={seguimentosGuia}
              loading={loading}
              title="Segmentos mais usados no guia turístico"
              emptyMessage="Aguardando dados de cliques no guia turístico."
            />
            <GraficoBarras
              dados={mobilidadeCategorias}
              loading={loading}
              title="Categorias mais usadas na mobilidade"
              emptyMessage="Aguardando dados de solicitações de mobilidade."
            />
          </>
        ) : null}

        {perfil === 'profissionais' ? (
          <>
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="mb-2 text-sm font-bold text-gray-900">Distribuição por categoria</h3>
              {loading ? (
                <div className="h-48 animate-pulse rounded-xl bg-gray-100" />
              ) : (
                <GraficoPizzaMercado
                  dados={profissionaisPorCategoria ?? []}
                  titulo=""
                  semTitulo
                  embed
                  mostrarComZero
                />
              )}
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="mb-2 text-sm font-bold text-gray-900">Distribuição por cidade</h3>
              {loading ? (
                <div className="h-48 animate-pulse rounded-xl bg-gray-100" />
              ) : (
                <GraficoPizzaMercado
                  dados={profissionaisPorCidade ?? []}
                  titulo=""
                  semTitulo
                  rosca
                  embed
                  mostrarComZero
                />
              )}
            </div>
          </>
        ) : null}

        {perfil === 'empresas' ? (
          <>
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="mb-2 text-sm font-bold text-gray-900">Distribuição por segmento</h3>
              {loading ? (
                <div className="h-48 animate-pulse rounded-xl bg-gray-100" />
              ) : (
                <GraficoPizzaMercado
                  dados={empresasSegmento ?? []}
                  titulo=""
                  semTitulo
                  embed
                  mostrarComZero
                />
              )}
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="mb-2 text-sm font-bold text-gray-900">Distribuição por cidade</h3>
              {loading ? (
                <div className="h-48 animate-pulse rounded-xl bg-gray-100" />
              ) : (
                <GraficoPizzaMercado
                  dados={empresasCidade ?? []}
                  titulo=""
                  semTitulo
                  rosca
                  embed
                  mostrarComZero
                />
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
