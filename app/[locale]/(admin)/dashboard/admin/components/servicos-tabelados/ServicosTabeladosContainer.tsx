'use client'

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { usePermissao } from '../../hooks/usePermissao'
import { useServicosTabeladosAdm } from '../../hooks/useServicosTabeladosAdm'
import {
  CATEGORIAS_TABELADOS,
  CIDADES_ORIGEM_TABELADO,
  type CategoriaTabeladoId,
} from '@/lib/servicosTabeladosCatalogo'
import { ServicosTabeladosCategoriaTabs } from './ServicosTabeladosCategoriaTabs'
import { PastaRotasCidade } from './PastaRotasCidade'

type Ctx = {
  categoria: CategoriaTabeladoId
  setCategoria: (c: CategoriaTabeladoId) => void
}

const ServicosTabeladosCtx = createContext<Ctx | null>(null)

function useServicosTabeladosCtx() {
  const ctx = useContext(ServicosTabeladosCtx)
  if (!ctx) throw new Error('useServicosTabeladosCtx requer provider')
  return ctx
}

export function ServicosTabeladosProvider({ children }: { children: ReactNode }) {
  const [categoria, setCategoria] = useState<CategoriaTabeladoId>('guia')
  const value = useMemo(() => ({ categoria, setCategoria }), [categoria])
  return <ServicosTabeladosCtx.Provider value={value}>{children}</ServicosTabeladosCtx.Provider>
}

export function ServicosTabeladosBarraFixa() {
  const { categoria, setCategoria } = useServicosTabeladosCtx()
  return (
    <div className="border-t border-gray-100 bg-white px-3 py-2.5 sm:px-4">
      <ServicosTabeladosCategoriaTabs value={categoria} onChange={setCategoria} />
    </div>
  )
}

export function ServicosTabeladosConteudo() {
  const { admin } = usePermissao()
  const { categoria } = useServicosTabeladosCtx()
  const { rotas, loading, salvando, salvarRota, excluirRota } = useServicosTabeladosAdm()

  const isAdminFinanceiro = Boolean(
    admin && (admin.admin_level === 1 || (admin.admin_permissoes as { cargo?: string })?.cargo === 'FINANCEIRO'),
  )

  const meta = CATEGORIAS_TABELADOS.find((c) => c.id === categoria)

  if (!isAdminFinanceiro) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Apenas ADM Geral ou ADM Financeiro podem gerenciar serviços tabelados.
      </div>
    )
  }

  if (loading) {
    return <p className="py-8 text-center text-sm text-gray-500">Carregando tabelas…</p>
  }

  return (
    <div className="space-y-3">
      {(meta?.cidades ?? []).map((cidadeId) => (
        <PastaRotasCidade
          key={`${categoria}-${cidadeId}`}
          categoria={categoria}
          cidadeId={cidadeId}
          rotas={rotas}
          salvando={salvando}
          onSalvar={async (dados) => {
            if (!admin) return { success: false, error: new Error('Sem permissão') }
            return salvarRota(
              {
                categoria,
                cidadeOrigem: cidadeId,
                pontoPartida: CIDADES_ORIGEM_TABELADO[cidadeId].pontoPartida,
                destinoFinal: dados.destino,
                valorRota: dados.valor,
                tipoPeriodoGuia: dados.tipoPeriodoGuia,
                horaInicio: dados.horaInicio,
                horaFim: dados.horaFim,
                horaSaida: dados.horaSaida,
                horaRetorno: dados.horaRetorno,
              },
              admin.id,
            )
          }}
          onExcluir={async (id) => {
            if (!window.confirm('Excluir esta rota da tabela?')) return
            await excluirRota(id)
          }}
        />
      ))}
    </div>
  )
}
