'use client'

import { useState } from 'react'
import { BarChart3, Filter, Gift } from 'lucide-react'
import { AdminSecaoChevron } from '../../shared/AdminSecaoChevron'
import { AnaliseBeneficios } from './AnaliseBeneficios'
import { FunilConversaoGeral } from './FunilConversaoGeral'
import { EstatisticasMercado } from './EstatisticasMercado'
import { useEmpresasAdm } from '../../../hooks/useEmpresasAdm'
import { useComissaoOfertaAdm } from '../../../hooks/useComissaoOfertaAdm'

export function EmpresasAdm() {
  const [busca, setBusca] = useState('')
  const [secoes, setSecoes] = useState({
    analise: true,
    estatisticas: false,
    funil: false,
  })

  const { empresas, loading, error } = useEmpresasAdm(busca)
  const comissaoPendentes = useComissaoOfertaAdm('pendente')
  const comissaoArquivados = useComissaoOfertaAdm('arquivados')

  const toggle = (key: keyof typeof secoes) => {
    setSecoes((p) => ({ ...p, [key]: !p[key] }))
  }

  return (
    <div className="space-y-2">
      <AdminSecaoChevron
        titulo="Análise de benefícios"
        tituloGrande
        icone={Gift}
        corTitulo="#0097b2"
        aberta={secoes.analise}
        onToggle={() => toggle('analise')}
        badge={comissaoPendentes.ofertas.length}
        badgeVermelho
      >
        <AnaliseBeneficios comissaoPendentes={comissaoPendentes} comissaoArquivados={comissaoArquivados} />
      </AdminSecaoChevron>

      <AdminSecaoChevron
        titulo="Estatísticas de mercado"
        tituloGrande
        icone={BarChart3}
        corTitulo="#0097b2"
        aberta={secoes.estatisticas}
        onToggle={() => toggle('estatisticas')}
      >
        <EstatisticasMercado />
      </AdminSecaoChevron>

      <AdminSecaoChevron
        titulo="Funil de Conversão (geral)"
        tituloGrande
        icone={Filter}
        corTitulo="#0097b2"
        aberta={secoes.funil}
        onToggle={() => toggle('funil')}
      >
        <FunilConversaoGeral
          busca={busca}
          onBuscaChange={setBusca}
          empresas={empresas}
          loading={loading}
        />
        {error ? <div className="mt-2 text-xs text-rose-600">{error.message}</div> : null}
      </AdminSecaoChevron>
    </div>
  )
}
