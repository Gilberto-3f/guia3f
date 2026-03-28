'use client'

import { useState } from 'react'
import { BuscadorEmpresas } from './BuscadorEmpresas'
import { FunilConversaoLista } from './FunilConversaoLista'
import { EstatisticasMercado } from './EstatisticasMercado'
import { PlaceholderCard } from '../../shared/PlaceholderCard'
import { useEmpresasAdm } from '../../../hooks/useEmpresasAdm'

export function EmpresasAdm() {
  const [busca, setBusca] = useState('')
  const [selecionada, setSelecionada] = useState<{ id: string; nome: string } | null>(null)
  const { empresas, loading, error } = useEmpresasAdm(busca)

  return (
    <div className="space-y-4">
      <EstatisticasMercado />

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-bold text-gray-900">🔍 Buscar empresa</div>
        <BuscadorEmpresas
          busca={busca}
          onBuscaChange={setBusca}
          empresas={empresas}
          loading={loading}
          onSelect={(emp) => setSelecionada({ id: emp.id, nome: emp.nome })}
        />
        {error ? <div className="mt-2 text-xs text-rose-600">{error.message}</div> : null}
      </div>

      {selecionada ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-2 text-sm font-bold text-gray-900">📈 Funil de conversão — {selecionada.nome}</div>
          <FunilConversaoLista empresaId={selecionada.id} />
        </div>
      ) : (
        <PlaceholderCard title="Selecione uma empresa para ver o funil de conversão" />
      )}
    </div>
  )
}

