'use client'

import { Users } from 'lucide-react'
import { emojiBandeiraPais } from '@/lib/empresaPaisUi'

const ARIA = /** @type {const} */ ({
  BR: 'Brasil',
  AR: 'Argentina',
  PY: 'Paraguai',
  geral: 'Todas as regiões (mensagem coletiva)',
})

const EMOJI_PAIS = /** @type {const} */ ({
  BR: '🇧🇷',
  AR: '🇦🇷',
  PY: '🇵🇾',
})

const tabBase =
  'flex min-h-[2.75rem] flex-1 max-w-[5rem] flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-2 text-center transition-all'

/**
 * @param {{
 *   paises: string[]
 *   abaAtiva: string
 *   onAbaChange: (pais: string) => void
 *   contadores?: Record<string, number>
 * }} props
 */
export default function CanalAbasPais({ paises, abaAtiva, onAbaChange, contadores = {} }) {
  return (
    <div className="border-b border-gray-100 bg-white px-3 py-2">
      <div
        className="mx-auto flex w-full max-w-md items-stretch justify-center gap-2"
        role="tablist"
        aria-label="Filtro por região"
      >
        {paises.map((pais) => {
          const ativo = abaAtiva === pais
          const a11y = ARIA[/** @type {keyof typeof ARIA} */ (pais)] ?? pais
          const ring = ativo
            ? 'bg-[#0097b2]/10 text-[#0097b2] ring-2 ring-[#0097b2] ring-offset-1 ring-offset-white'
            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'

          if (pais === 'geral') {
            return (
              <button
                key={pais}
                type="button"
                role="tab"
                aria-selected={ativo}
                title={a11y}
                aria-label={a11y}
                onClick={() => onAbaChange(pais)}
                className={`${tabBase} ${ring}`}
              >
                <Users className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
                <span className="text-[10px] font-medium leading-tight">Todos</span>
                {contadores[pais] !== undefined ? (
                  <span className="rounded bg-gray-100 px-1 text-[10px] tabular-nums text-gray-600">
                    {contadores[pais]}
                  </span>
                ) : null}
              </button>
            )
          }

          const emoji =
            EMOJI_PAIS[/** @type {keyof typeof EMOJI_PAIS} */ (pais)] ||
            emojiBandeiraPais(/** @type {'BR'|'AR'|'PY'} */ (pais))

          return (
            <button
              key={pais}
              type="button"
              role="tab"
              aria-selected={ativo}
              title={a11y}
              aria-label={a11y}
              onClick={() => onAbaChange(pais)}
              className={`${tabBase} ${ring} ${!ativo ? 'opacity-85' : ''}`}
            >
              <span className="text-2xl leading-none" aria-hidden>
                {emoji}
              </span>
              {contadores[pais] !== undefined ? (
                <span className="rounded bg-gray-100 px-1 text-[10px] tabular-nums text-gray-600">
                  {contadores[pais]}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
