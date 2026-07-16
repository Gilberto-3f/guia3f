'use client'

import { useMemo } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useEmpresaServicosPlano } from '@/hooks/useEmpresaServicosPlano'
import { empresaEhSegmentoLojasParaguai } from '@/lib/cidade-empresa'
import { useDashboardEmpresa } from '../../hooks/useDashboardEmpresa'
import { useDrenaStok } from '../../hooks/useDrenaStok'
import SeusProdutos from './SeusProdutos'
import DrenaGraficos from './DrenaGraficos'
import DrenaHistorico from './DrenaHistorico'

export default function DrenaStok() {
  const router = useRouter()
  const { dados: empresa } = useDashboardEmpresa()
  const { temServico } = useEmpresaServicosPlano(empresa?.plano, empresa?.id)

  const isCDE = useMemo(() => {
    const cidadeOk = empresaEhSegmentoLojasParaguai(empresa?.categoria, empresa?.cidade)
    return Boolean(cidadeOk && temServico('compras_paraguai_drena'))
  }, [empresa?.categoria, empresa?.cidade, temServico])

  const drena = useDrenaStok(empresa?.id ?? null, isCDE)

  if (!isCDE) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-8 text-center">
        <p className="text-yellow-800">
          Drena-Stok é exclusivo para empresas de Ciudad del Este com o serviço Compras CDE no plano
          contratado.
        </p>
        <p className="mt-2 text-sm text-yellow-700">Faça um upgrade do seu plano para acessar esta funcionalidade.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SeusProdutos
        totalProdutos={drena.totalProdutos}
        totalBuscas={drena.totalBuscasProdutos}
        desempenho={drena.desempenho}
        onVerProdutos={() => router.push('/empresa/menu/botao-dinamico')}
        onCadastrarNovo={() => router.push('/empresa/menu/botao-dinamico')}
      />

      <div className="flex gap-2 border-b border-gray-200">
        {(
          [
            { id: 'graficos' as const, label: 'Gráficos' },
            { id: 'historico' as const, label: 'Histórico' },
          ]
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => drena.setAba(t.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${
              drena.aba === t.id
                ? 'border-[#0097b2] text-[#0097b2]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {drena.loading ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      ) : drena.error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center text-red-800">
          Erro ao carregar Drena-Stok: {drena.error.message}
        </div>
      ) : drena.aba === 'graficos' ? (
        <DrenaGraficos
          periodo={drena.periodo}
          onPeriodo={drena.setPeriodo}
          ranking={drena.rankingTermos}
          pizza={drena.pizzaCategorias}
        />
      ) : (
        <DrenaHistorico
          ano={drena.histAno}
          mes={drena.histMes}
          onAno={drena.setHistAno}
          onMes={drena.setHistMes}
          termo={drena.histTermo}
          onTermo={drena.setHistTermo}
          snapshot={drena.snapshotMes}
          serie={drena.serieLinha}
          labelMes={drena.labelMes}
        />
      )}

      <div className="rounded-lg bg-gray-50 p-4 text-center text-xs text-gray-500">
        Dados baseados em intenções do hub Compras CDE. Snapshot mensal materializado no dia 1.
      </div>
    </div>
  )
}
