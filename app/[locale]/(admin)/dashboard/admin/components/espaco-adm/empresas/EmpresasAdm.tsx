'use client'

import { useState } from 'react'
import { AdminSecaoChevron } from '../../shared/AdminSecaoChevron'
import { AnaliseBeneficios } from './AnaliseBeneficios'
import { BuscadorEmpresas } from './BuscadorEmpresas'
import { FunilConversaoLista } from './FunilConversaoLista'
import { EstatisticasMercado } from './EstatisticasMercado'
import { PlaceholderCard } from '../../shared/PlaceholderCard'
import { useEmpresasAdm } from '../../../hooks/useEmpresasAdm'
import { useComissaoOfertaAdm } from '../../../hooks/useComissaoOfertaAdm'

export function EmpresasAdm() {
  const [busca, setBusca] = useState('')
  const [selecionada, setSelecionada] = useState<{ id: string; nome: string } | null>(null)
  const [secoes, setSecoes] = useState({
    analise: true,
    estatisticas: false,
    busca: false,
  })

  const { empresas, loading, error } = useEmpresasAdm(busca)
  const comissaoAdm = useComissaoOfertaAdm('pendente')

  const toggle = (key: keyof typeof secoes) => {
    setSecoes((p) => ({ ...p, [key]: !p[key] }))
  }

  return (
    <div className="space-y-2">
      <AdminSecaoChevron
        titulo="Análise de benefícios"
        aberta={secoes.analise}
        onToggle={() => toggle('analise')}
        badge={comissaoAdm.ofertas.length}
      >
        <p className="mb-3 text-xs text-gray-600">
          Revise as ofertas de comissão cadastradas pelas empresas. Após aprovação, ficam visíveis para os
          profissionais da comunidade indicada.
        </p>
        <AnaliseBeneficios comissao={comissaoAdm} />
      </AdminSecaoChevron>

      <AdminSecaoChevron
        titulo="Estatísticas de mercado"
        aberta={secoes.estatisticas}
        onToggle={() => toggle('estatisticas')}
      >
        <EstatisticasMercado />
      </AdminSecaoChevron>

      <AdminSecaoChevron titulo="Buscar empresa" aberta={secoes.busca} onToggle={() => toggle('busca')}>
        <BuscadorEmpresas
          busca={busca}
          onBuscaChange={setBusca}
          empresas={empresas}
          loading={loading}
          onSelect={(emp) => setSelecionada({ id: emp.id, nome: emp.nome })}
        />
        {error ? <div className="mt-2 text-xs text-rose-600">{error.message}</div> : null}
        {selecionada ? (
          <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-3">
            <div className="mb-2 text-sm font-bold text-gray-900">Funil de conversão — {selecionada.nome}</div>
            <FunilConversaoLista empresaId={selecionada.id} />
          </div>
        ) : (
          <div className="mt-4">
            <PlaceholderCard title="Selecione uma empresa na lista para ver o funil de conversão" />
          </div>
        )}
      </AdminSecaoChevron>
    </div>
  )
}
