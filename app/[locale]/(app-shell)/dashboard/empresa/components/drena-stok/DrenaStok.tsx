'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useEmpresaServicosPlano } from '@/hooks/useEmpresaServicosPlano'
import { empresaEhSegmentoLojasParaguai } from '@/lib/cidade-empresa'
import { useDashboardEmpresa } from '../../hooks/useDashboardEmpresa'
import { useDrenaStok } from '../../hooks/useDrenaStok'

import PesquisaProduto from './PesquisaProduto'
import RankingMarcas from './RankingMarcas'
import RankingProdutos from './RankingProdutos'
import SegmentosAlta from './SegmentosAlta'
import SeusProdutos from './SeusProdutos'
import TendenciasTempoReal from './TendenciasTempoReal'

export default function DrenaStok() {
  const router = useRouter()
  const { dados: empresa } = useDashboardEmpresa()
  const { temServico } = useEmpresaServicosPlano(empresa?.plano, empresa?.id)

  const isCDE = useMemo(() => {
    const cidadeOk = empresaEhSegmentoLojasParaguai(empresa?.categoria, empresa?.cidade)
    return Boolean(cidadeOk && temServico('compras_paraguai_drena'))
  }, [empresa?.categoria, empresa?.cidade, temServico])

  const {
    totalProdutos,
    totalBuscasProdutos,
    desempenho,
    rankingProdutos,
    rankingMarcas,
    segmentosAlta,
    tendencias,
    loading,
    error,
  } = useDrenaStok(empresa?.id ?? null, isCDE)

  if (!isCDE) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-8 text-center">
        <p className="text-yellow-800">
          📦 Drena-Stok é exclusivo para empresas de Ciudad del Este com o serviço Compras Paraguai no plano contratado.
        </p>
        <p className="mt-2 text-sm text-yellow-700">Faça um upgrade do seu plano para acessar esta funcionalidade.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-48 rounded-lg bg-gray-100 animate-pulse" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center text-red-800">
        Erro ao carregar Drena-Stok: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SeusProdutos
        totalProdutos={totalProdutos}
        totalBuscas={totalBuscasProdutos}
        desempenho={desempenho}
        onVerProdutos={() => router.push('/compras-paraguai/meus-produtos')}
        onCadastrarNovo={() => router.push('/compras-paraguai/cadastrar-produto')}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RankingProdutos produtos={rankingProdutos} />
        <RankingMarcas marcas={rankingMarcas} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SegmentosAlta segmentos={segmentosAlta} />
        <PesquisaProduto />
      </div>

      <TendenciasTempoReal tendencias={tendencias} />

      <div className="rounded-lg bg-gray-50 p-4 text-center text-xs text-gray-500">
        ℹ️ Dados baseados em buscas de usuários no Comparador de Preços. Atualização em tempo real.
      </div>
    </div>
  )
}

