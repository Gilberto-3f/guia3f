'use client'

import { ChevronDown } from 'lucide-react'
import type { TermoRanking } from '@/lib/drenaAnalytics'

type Props = {
  titulo: string
  /** Esconde o h4 interno (quando o título já está nas abas Turistas/Profissionais). */
  ocultarTitulo?: boolean
  grupos: TermoRanking[][]
  gruposLiberados: number
  onLiberarProximo: () => void
}

/** Ranking 100+ fracionado em grupos de 20. */
export default function Ranking100Grupos({
  titulo,
  ocultarTitulo = false,
  grupos,
  gruposLiberados,
  onLiberarProximo,
}: Props) {
  const liberados = Math.max(1, Math.min(5, gruposLiberados))
  const proximoGrupo = grupos[liberados]
  const temProximo = liberados < 5 && (proximoGrupo?.length ?? 0) > 0
  const esgotou = liberados < 5 && !(proximoGrupo?.length ?? 0)

  const visiveis = grupos.slice(0, liberados)
  const temAlgum = visiveis.some((g) => g.length > 0)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      {ocultarTitulo ? null : <h4 className="mb-2 text-sm font-bold text-[#001f3f]">{titulo}</h4>}
      {!temAlgum ? (
        <p className="py-4 text-center text-xs text-gray-400">Nenhuma busca neste período.</p>
      ) : (
        <div className="space-y-3">
          {visiveis.map((grupo, gi) => {
            if (!grupo.length) return null
            return (
              <div key={gi}>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  Grupo {gi + 1} · {gi * 20 + 1}–{gi * 20 + grupo.length}
                </p>
                <ol className="space-y-1 text-sm">
                  {grupo.map((t, i) => (
                    <li
                      key={t.termo_normalizado}
                      className="flex items-center gap-2 rounded-lg bg-gray-50 px-2 py-1.5 text-gray-700"
                    >
                      <span className="w-6 shrink-0 text-right text-xs font-bold text-[#0097b2]">
                        {gi * 20 + i + 1}.
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium">{t.termo}</span>
                      <span className="shrink-0 tabular-nums text-xs text-gray-500">{t.total}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )
          })}
        </div>
      )}

      {temProximo ? (
        <button
          type="button"
          onClick={onLiberarProximo}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#00D443] py-2 text-xs font-bold text-white hover:opacity-95"
        >
          <ChevronDown className="h-4 w-4" aria-hidden />
          Liberar próximo grupo (20 termos)
        </button>
      ) : esgotou && temAlgum ? (
        <p className="mt-2 text-center text-[10px] text-gray-400">Não há mais termos neste período.</p>
      ) : null}
    </div>
  )
}
