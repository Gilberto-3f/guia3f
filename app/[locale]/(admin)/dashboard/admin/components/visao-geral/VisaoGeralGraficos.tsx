'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FiltrosVisaoGeral, PerfilVisaoGeral } from '../../types/admin.types'
import { useAdminData } from '../../hooks/useAdminData'
import { AdminSecaoChevron } from '../shared/AdminSecaoChevron'
import { GraficoLinha } from './GraficoLinha'
import { GraficoBarras } from './GraficoBarras'
import GraficoPizzaMercado from '@/app/[locale]/(app-shell)/dashboard/empresa/components/estatisticas-mercado/GraficoPizza'

const TITULOS_PERFIL: Record<PerfilVisaoGeral, string> = {
  turistas: 'Turistas',
  profissionais: 'Profissionais',
  empresas: 'Empresas',
}

type SecaoId =
  | 'crescimento'
  | 'ativos'
  | 'seguimentos'
  | 'mobilidade'
  | 'prof-categoria'
  | 'prof-cidade'
  | 'emp-segmento'
  | 'emp-cidade'

function secoesPorPerfil(perfil: PerfilVisaoGeral): SecaoId[] {
  if (perfil === 'turistas') {
    return ['crescimento', 'ativos', 'seguimentos', 'mobilidade']
  }
  if (perfil === 'profissionais') {
    return ['crescimento', 'ativos', 'prof-categoria', 'prof-cidade']
  }
  return ['crescimento', 'ativos', 'emp-segmento', 'emp-cidade']
}

const TITULOS_SECAO: Record<SecaoId, string> = {
  crescimento: 'Crescimento de usuários',
  ativos: 'Ativos no app',
  seguimentos: 'Segmentos mais usados no guia turístico',
  mobilidade: 'Categorias mais usadas na mobilidade',
  'prof-categoria': 'Distribuição por categoria',
  'prof-cidade': 'Distribuição por cidade',
  'emp-segmento': 'Distribuição por segmento',
  'emp-cidade': 'Distribuição por cidade',
}

export function VisaoGeralGraficos({
  perfil,
  filtros,
}: {
  perfil: PerfilVisaoGeral
  filtros: FiltrosVisaoGeral
}) {
  const ids = useMemo(() => secoesPorPerfil(perfil), [perfil])

  const [abertos, setAbertos] = useState<Record<SecaoId, boolean>>(() =>
    Object.fromEntries(ids.map((id) => [id, true])) as Record<SecaoId, boolean>,
  )

  useEffect(() => {
    setAbertos(Object.fromEntries(ids.map((id) => [id, true])) as Record<SecaoId, boolean>)
  }, [ids])

  const toggle = useCallback((id: SecaoId) => {
    setAbertos((atual) => ({ ...atual, [id]: !atual[id] }))
  }, [])

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

  function renderConteudo(id: SecaoId) {
    switch (id) {
      case 'crescimento':
        return <GraficoLinha dados={crescimento} loading={loading} title={TITULOS_SECAO.crescimento} semTitulo />
      case 'ativos':
        return loading ? (
          <div className="h-48 animate-pulse rounded-xl bg-gray-100" />
        ) : (
          <GraficoPizzaMercado dados={ativos ?? []} titulo="" semTitulo embed mostrarComZero />
        )
      case 'seguimentos':
        return (
          <GraficoBarras
            dados={seguimentosGuia}
            loading={loading}
            title={TITULOS_SECAO.seguimentos}
            semTitulo
            emptyMessage="Aguardando dados de cliques no guia turístico."
          />
        )
      case 'mobilidade':
        return (
          <GraficoBarras
            dados={mobilidadeCategorias}
            loading={loading}
            title={TITULOS_SECAO.mobilidade}
            semTitulo
            emptyMessage="Aguardando dados de solicitações de mobilidade."
          />
        )
      case 'prof-categoria':
        return loading ? (
          <div className="h-48 animate-pulse rounded-xl bg-gray-100" />
        ) : (
          <GraficoPizzaMercado
            dados={profissionaisPorCategoria ?? []}
            titulo=""
            semTitulo
            embed
            mostrarComZero
          />
        )
      case 'prof-cidade':
        return loading ? (
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
        )
      case 'emp-segmento':
        return loading ? (
          <div className="h-48 animate-pulse rounded-xl bg-gray-100" />
        ) : (
          <GraficoPizzaMercado dados={empresasSegmento ?? []} titulo="" semTitulo embed mostrarComZero />
        )
      case 'emp-cidade':
        return loading ? (
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
        )
      default:
        return null
    }
  }

  return (
    <div className="min-w-0 space-y-4">
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Não foi possível carregar os dados da Visão Geral. Tente novamente em instantes.
        </div>
      ) : null}

      <h2 className="text-center text-lg font-bold uppercase tracking-wide text-[#0097b2] sm:text-xl">
        {tituloPerfil}
      </h2>

      <div className="space-y-3">
        {ids.map((id) => (
          <AdminSecaoChevron
            key={`${perfil}-${id}`}
            titulo={TITULOS_SECAO[id]}
            tituloGrande
            aberta={Boolean(abertos[id])}
            onToggle={() => toggle(id)}
          >
            {renderConteudo(id)}
          </AdminSecaoChevron>
        ))}
      </div>
    </div>
  )
}
