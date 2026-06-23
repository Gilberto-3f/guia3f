'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { AdminSecaoChevron } from '../shared/AdminSecaoChevron'
import {
  CIDADES_ORIGEM_TABELADO,
  descricaoPeriodoRota,
  type CategoriaTabeladoId,
  type CidadeOrigemTabeladoId,
  type RotaTabelada,
} from '@/lib/servicosTabeladosCatalogo'
import { CardNovaTabela, type NovaTabelaFormData } from './CardNovaTabela'

export function PastaRotasCidade({
  categoria,
  cidadeId,
  rotas,
  salvando,
  onSalvar,
  onExcluir,
}: {
  categoria: CategoriaTabeladoId
  cidadeId: CidadeOrigemTabeladoId
  rotas: RotaTabelada[]
  salvando: boolean
  onSalvar: (dados: NovaTabelaFormData) => Promise<{ success: boolean; error?: unknown }>
  onExcluir: (id: string) => Promise<void>
}) {
  const meta = CIDADES_ORIGEM_TABELADO[cidadeId]
  const [aberta, setAberta] = useState(false)
  const [criando, setCriando] = useState(false)

  const rotasPasta = rotas.filter((r) => r.categoria === categoria && r.cidadeOrigem === cidadeId)

  return (
    <AdminSecaoChevron
      titulo={meta.label}
      aberta={aberta}
      onToggle={() => setAberta((p) => !p)}
      corTitulo="#0097b2"
      badge={rotasPasta.length}
    >
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setCriando(true)
          }}
          className="absolute right-0 top-0 z-10 flex items-center gap-2 rounded-full bg-[#0097b2] py-1.5 pl-1.5 pr-3 text-xs font-bold text-white shadow-md transition hover:bg-[#007a91]"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
            <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
          </span>
          Criar Nova Tabela
        </button>

        {criando ? (
          <div className="mb-3 pr-36">
            <CardNovaTabela
              categoria={categoria}
              pontoPartida={meta.pontoPartida}
              salvando={salvando}
              onCancelar={() => setCriando(false)}
              onConfirmar={async (dados) => {
                const res = await onSalvar(dados)
                if (res.success) setCriando(false)
                return res
              }}
            />
          </div>
        ) : null}

        {rotasPasta.length === 0 && !criando ? (
          <p className="py-6 text-center text-sm text-gray-500">Nenhuma tabela cadastrada nesta região.</p>
        ) : (
          <ul className="space-y-2">
            {rotasPasta.map((rota) => {
              const periodo = descricaoPeriodoRota(rota)
              return (
              <li
                key={rota.id}
                className="flex items-start justify-between gap-2 rounded-xl border border-gray-200 bg-white p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-900">
                    {rota.pontoPartida} → {rota.destinoFinal}
                  </p>
                  {periodo ? (
                    <p className="mt-1 text-xs font-medium text-gray-700">{periodo}</p>
                  ) : null}
                  <p className="mt-1 text-sm text-[#0097b2]">
                    R$ {rota.valorRota.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-500">Apenas deslocamento (tickets à parte)</p>
                </div>
                <button
                  type="button"
                  onClick={() => void onExcluir(rota.id)}
                  disabled={salvando}
                  className="shrink-0 rounded-lg border border-rose-200 p-2 text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                  aria-label="Excluir rota"
                  title="Excluir"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </li>
            )})}
          </ul>
        )}
      </div>
    </AdminSecaoChevron>
  )
}
