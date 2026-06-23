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
      <div className="space-y-4">
        {!criando ? (
          <div className="flex justify-center px-1">
            <button
              type="button"
              onClick={() => setCriando(true)}
              className="inline-flex max-w-full items-center gap-2 rounded-full bg-[#0097b2] py-2 pl-2 pr-4 text-sm font-bold text-white shadow-md transition hover:bg-[#007a91]"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20">
                <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
              </span>
              <span className="truncate">Criar Nova Tabela</span>
            </button>
          </div>
        ) : null}

        {criando ? (
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
        ) : null}

        {rotasPasta.length === 0 && !criando ? (
          <p className="py-4 text-center text-sm text-gray-500">Nenhuma tabela cadastrada nesta região.</p>
        ) : rotasPasta.length > 0 ? (
          <ul className="space-y-2">
            {rotasPasta.map((rota) => {
              const periodo = descricaoPeriodoRota(rota)
              return (
                <li
                  key={rota.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3 sm:p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold leading-snug text-gray-900 sm:text-base">
                      {rota.pontoPartida} → {rota.destinoFinal}
                    </p>
                    {periodo ? <p className="mt-1.5 text-xs font-medium text-gray-700 sm:text-sm">{periodo}</p> : null}
                    <p className="mt-1.5 text-sm text-[#0097b2] sm:text-base">
                      R$ {rota.valorRota.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="mt-0.5 text-[11px] text-gray-500 sm:text-xs">
                      Apenas deslocamento (tickets à parte)
                    </p>
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
              )
            })}
          </ul>
        ) : null}
      </div>
    </AdminSecaoChevron>
  )
}
