'use client'

import { useState } from 'react'
import { Archive, CalendarRange, FileSearch, type LucideIcon } from 'lucide-react'

const VERDE = '#00D443'

type SubAba = 'arquivo' | 'linha'

const SUBS: { id: SubAba; label: string; Icon: LucideIcon }[] = [
  { id: 'arquivo', label: 'Arquivo', Icon: Archive },
  { id: 'linha', label: 'Linha do Tempo', Icon: CalendarRange },
]

/** Histórico — Arquivo mensal + Linha do Tempo (dados nas fases 5–6). */
export default function AbaHistorico() {
  const [sub, setSub] = useState<SubAba>('arquivo')

  return (
    <div className="space-y-4">
      <div className="flex gap-2" role="tablist" aria-label="Histórico Drena-Stok">
        {SUBS.map(({ id, label, Icon }) => {
          const ativa = sub === id
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={ativa}
              onClick={() => setSub(id)}
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition ${
                ativa ? 'text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
              style={ativa ? { backgroundColor: VERDE } : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
              <span className={ativa ? 'inline' : 'hidden sm:inline'}>{label}</span>
            </button>
          )
        })}
      </div>

      {sub === 'arquivo' ? (
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <header className="flex items-center gap-2 border-b border-gray-100 bg-[#f5f5f5] px-4 py-3">
            <Archive className="h-5 w-5 shrink-0 text-[#0097b2]" strokeWidth={2.25} aria-hidden />
            <h2 className="text-sm font-bold text-[#001f3f]">Arquivo mensal</h2>
          </header>
          <div className="space-y-3 p-4">
            <p className="text-xs text-gray-500">
              Resumos congelados de cada mês (Ranking 100+, Recomendações, Categorias e Gráficos) via{' '}
              <code className="rounded bg-gray-100 px-1">drena_arquivo_mensal</code>.
            </p>
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-8 text-center">
              <CalendarRange className="mx-auto h-8 w-8 text-gray-300" strokeWidth={1.75} aria-hidden />
              <p className="mt-2 text-sm font-medium text-gray-600">Seletor mês / ano + pacotes do arquivo</p>
              <p className="mt-1 text-xs text-gray-400">Disponível na próxima fase.</p>
            </div>
          </div>
        </section>
      ) : (
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <header className="flex items-center gap-2 border-b border-gray-100 bg-[#f5f5f5] px-4 py-3">
            <FileSearch className="h-5 w-5 shrink-0 text-[#0097b2]" strokeWidth={2.25} aria-hidden />
            <h2 className="text-sm font-bold text-[#001f3f]">Linha do Tempo</h2>
          </header>
          <div className="space-y-3 p-4">
            <p className="text-xs text-gray-500">
              Filtro exclusivo: Palavra-chave · Categoria · Subcategoria · Marca + intervalo de datas →
              Relatório dos últimos 12 meses (Filtro / Motor / Recomendações).
            </p>
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-8 text-center">
              <FileSearch className="mx-auto h-8 w-8 text-gray-300" strokeWidth={1.75} aria-hidden />
              <p className="mt-2 text-sm font-medium text-gray-600">Motor de busca + Relatório de Pesquisa</p>
              <p className="mt-1 text-xs text-gray-400">Disponível na próxima fase.</p>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
