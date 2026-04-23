'use client'

import { Globe2 } from 'lucide-react'

/** Bandeiras em SVG (proporção 3:2), sem emojis. */
function FlagBr({ className = 'h-4 w-6' }) {
  return (
    <svg viewBox="0 0 3 2" className={className} aria-hidden>
      <rect width="3" height="2" fill="#009b3a" />
      <path d="M0,1L1.5,0.25L3,1L1.5,1.75Z" fill="#ffcc29" />
      <circle cx="1.5" cy="1" r="0.38" fill="#28166f" />
    </svg>
  )
}

function FlagAr({ className = 'h-4 w-6' }) {
  return (
    <svg viewBox="0 0 3 2" className={className} aria-hidden>
      <rect width="1" height="2" x="0" y="0" fill="#74acdf" />
      <rect width="1" height="2" x="1" y="0" fill="#fff" />
      <rect width="1" height="2" x="2" y="0" fill="#74acdf" />
      <circle cx="1.5" cy="0.7" r="0.1" fill="#f6b40e" />
    </svg>
  )
}

function FlagPy({ className = 'h-4 w-6' }) {
  return (
    <svg viewBox="0 0 3 2" className={className} aria-hidden>
      <rect width="3" height="0.67" y="0" fill="#d52b1e" />
      <rect width="3" height="0.66" y="0.67" fill="#fff" />
      <rect width="3" height="0.67" y="1.33" fill="#0038a8" />
    </svg>
  )
}

const ARIA = /** @type {const} */ ({
  BR: 'Brasil',
  AR: 'Argentina',
  PY: 'Paraguai',
  geral: 'Todas as regiões',
})

const FLAG = /** @type {const} */ ({
  BR: FlagBr,
  AR: FlagAr,
  PY: FlagPy,
})

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
    <div className="border-b border-gray-100 bg-white">
      <div className="flex items-stretch justify-start gap-1 overflow-x-auto px-2 py-1.5" role="tablist" aria-label="Filtro por região">
        {paises.map((pais) => {
          const ativo = abaAtiva === pais
          const a11y = ARIA[/** @type {keyof typeof ARIA} */ (pais)] ?? pais
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
                className={`flex shrink-0 items-center justify-center rounded-md p-2 transition-all ${
                  ativo
                    ? 'text-[#0097b2] ring-2 ring-[#0097b2] ring-offset-1 ring-offset-white'
                    : 'text-gray-400 opacity-80 hover:opacity-100'
                }`}
              >
                <Globe2 className="h-5 w-5" strokeWidth={2} aria-hidden />
                {contadores[pais] !== undefined ? (
                  <span className="ml-0.5 rounded bg-gray-100 px-1 py-0.5 text-xs text-gray-600 tabular-nums">
                    {contadores[pais]}
                  </span>
                ) : null}
              </button>
            )
          }
          const Cmp = FLAG[/** @type {keyof typeof FLAG} */ (pais)]
          return (
            <button
              key={pais}
              type="button"
              role="tab"
              aria-selected={ativo}
              title={a11y}
              aria-label={a11y}
              onClick={() => onAbaChange(pais)}
              className={`flex shrink-0 items-center justify-center rounded-md p-1.5 transition-all ${
                ativo
                  ? 'text-[#0097b2] ring-2 ring-[#0097b2] ring-offset-1 ring-offset-white'
                  : 'p-1.5 text-gray-400 opacity-75 grayscale filter hover:opacity-100'
              }`}
            >
              {Cmp ? <Cmp className={ativo ? 'h-5 w-[1.4rem] rounded-sm' : 'h-5 w-[1.4rem] rounded-sm'} /> : null}
              {contadores[pais] !== undefined ? (
                <span className="ml-0.5 rounded bg-gray-100 px-1 py-0.5 text-xs text-gray-600 tabular-nums">
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
