'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Smartphone, Eye, Car, LineChart, MapPin, PieChart } from 'lucide-react'
import type { FiltrosVisaoGeral, PerfilVisaoGeral } from '../../types/admin.types'
import { useAdminData } from '../../hooks/useAdminData'
import { AdminSecaoChevron } from '../shared/AdminSecaoChevron'
import { GraficoLinha } from './GraficoLinha'
import { GraficoBarras } from './GraficoBarras'
import GraficoPizzaMercado from '@/app/[locale]/(app-shell)/dashboard/empresa/components/estatisticas-mercado/GraficoPizza'
import { MaisProcuradosEcossistemaPainel } from './MaisProcuradosEcossistemaPainel'
import { AtivosProfissionaisPainel } from './AtivosProfissionaisPainel'

const COR_LOGO = '#0097b2'

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
    return ['ativos', 'seguimentos', 'mobilidade', 'crescimento']
  }
  if (perfil === 'profissionais') {
    return ['ativos', 'prof-categoria', 'prof-cidade', 'crescimento']
  }
  return ['ativos', 'emp-segmento', 'emp-cidade', 'crescimento']
}

const TITULOS_SECAO: Record<SecaoId, string> = {
  crescimento: 'Crescimento de usuários',
  ativos: 'Ativos no app',
  seguimentos: 'Mais procurados (no guia)',
  mobilidade: 'Mais solicitados (na mobilidade)',
  'prof-categoria': 'Distribuição por categoria',
  'prof-cidade': 'Distribuição por cidade',
  'emp-segmento': 'Distribuição por segmento',
  'emp-cidade': 'Distribuição por cidade',
}

type SecaoMeta = {
  titulo: string
  Icon: LucideIcon
  descricao: string
}

const SECOES_TURISTAS: Partial<Record<SecaoId, SecaoMeta>> = {
  ativos: {
    titulo: 'Ativos no APP',
    Icon: Smartphone,
    descricao: 'Turistas ativos no app nos últimos 3 dias',
  },
  seguimentos: {
    titulo: 'Mais Procurados',
    Icon: Eye,
    descricao: 'Seguimentos mais acessados no guia',
  },
  mobilidade: {
    titulo: 'Mais Solicitados',
    Icon: Car,
    descricao: 'Categorias mais contratadas pelo APP',
  },
  crescimento: {
    titulo: 'Crescimento de Usuários',
    Icon: LineChart,
    descricao: 'Novos cadastros de turistas',
  },
}

const SECOES_EMPRESAS: Partial<Record<SecaoId, SecaoMeta>> = {
  ativos: {
    titulo: 'Ativos no APP',
    Icon: Smartphone,
    descricao: 'Empresas ativas no app nos últimos 3 dias',
  },
  'emp-segmento': {
    titulo: 'Distribuição (Seguimento)',
    Icon: PieChart,
    descricao: 'Porcentagem de empresas por seguimento',
  },
  'emp-cidade': {
    titulo: 'Distribuição por Cidade',
    Icon: MapPin,
    descricao: 'Porcentagem de empresas por cidade',
  },
  crescimento: {
    titulo: 'Crescimento de Usuários',
    Icon: LineChart,
    descricao: 'Novos cadastros de empresas',
  },
}

const SECOES_PROFISSIONAIS: Partial<Record<SecaoId, SecaoMeta>> = {
  ativos: {
    titulo: 'Ativos no APP',
    Icon: Smartphone,
    descricao: 'Profissionais ativos no app nos últimos 3 dias',
  },
  'prof-categoria': {
    titulo: 'Distribuição por Categoria',
    Icon: Car,
    descricao: 'Porcentagem de profissionais por categoria',
  },
  'prof-cidade': {
    titulo: 'Distribuição por Cidade',
    Icon: MapPin,
    descricao: 'Porcentagem de profissionais por cidade',
  },
  crescimento: {
    titulo: 'Crescimento de Usuários',
    Icon: LineChart,
    descricao: 'Novos cadastros de profissionais',
  },
}

const MAIS_PROCURADOS_VAZIO = {
  visibilidade: [],
  engajamento: [],
}

function metaSecao(perfil: PerfilVisaoGeral, id: SecaoId): SecaoMeta | undefined {
  if (perfil === 'turistas') return SECOES_TURISTAS[id]
  if (perfil === 'profissionais') return SECOES_PROFISSIONAIS[id]
  if (perfil === 'empresas') return SECOES_EMPRESAS[id]
  return undefined
}

export function VisaoGeralGraficos({
  perfil,
  filtros,
}: {
  perfil: PerfilVisaoGeral
  filtros: FiltrosVisaoGeral
}) {
  const ids = useMemo(() => secoesPorPerfil(perfil), [perfil])
  const usaEstiloPerfil = perfil === 'turistas' || perfil === 'profissionais' || perfil === 'empresas'

  const [abertos, setAbertos] = useState<Record<SecaoId, boolean>>(() =>
    Object.fromEntries(ids.map((id) => [id, false])) as Record<SecaoId, boolean>,
  )

  useEffect(() => {
    setAbertos(Object.fromEntries(ids.map((id) => [id, false])) as Record<SecaoId, boolean>)
  }, [ids])

  const toggle = useCallback((id: SecaoId) => {
    setAbertos((atual) => ({ ...atual, [id]: !atual[id] }))
  }, [])

  const {
    crescimento,
    ativos,
    ativosComunidadeProfissionais,
    maisProcuradosTuristas,
    mobilidadeCategorias,
    profissionaisPorCategoria,
    profissionaisPorCidade,
    empresasCidade,
    empresasSegmento,
    loading,
    error,
  } = useAdminData(perfil, filtros)

  function renderConteudo(id: SecaoId) {
    switch (id) {
      case 'crescimento':
        return <GraficoLinha dados={crescimento} loading={loading} title={TITULOS_SECAO.crescimento} semTitulo />
      case 'ativos':
        if (perfil === 'profissionais') {
          return (
            <AtivosProfissionaisPainel
              faixas={ativos ?? []}
              comunidades={ativosComunidadeProfissionais}
              loading={loading}
            />
          )
        }
        return loading ? (
          <div className="h-48 animate-pulse rounded-xl bg-gray-100" />
        ) : (
          <GraficoPizzaMercado dados={ativos ?? []} titulo="" semTitulo embed mostrarComZero />
        )
      case 'seguimentos':
        return loading ? (
          <div className="h-48 animate-pulse rounded-xl bg-gray-100" />
        ) : (
          <MaisProcuradosEcossistemaPainel dados={maisProcuradosTuristas ?? MAIS_PROCURADOS_VAZIO} />
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
          Não foi possível carregar os dados do Ecossistema. Tente novamente em instantes.
        </div>
      ) : null}

      <div className="space-y-3">
        {ids.map((id) => {
          const secaoMeta = metaSecao(perfil, id)

          return (
            <AdminSecaoChevron
              key={`${perfil}-${id}`}
              titulo={secaoMeta?.titulo ?? TITULOS_SECAO[id]}
              tituloGrande
              aberta={Boolean(abertos[id])}
              onToggle={() => toggle(id)}
              icone={secaoMeta?.Icon}
              corTitulo={usaEstiloPerfil && secaoMeta ? COR_LOGO : undefined}
              descricao={secaoMeta?.descricao}
            >
              {renderConteudo(id)}
            </AdminSecaoChevron>
          )
        })}
      </div>
    </div>
  )
}
