'use client'

const NOMES = {
  BR: { nome: 'Brasil', bandeira: '🇧🇷' },
  AR: { nome: 'Argentina', bandeira: '🇦🇷' },
  PY: { nome: 'Paraguai', bandeira: '🇵🇾' },
  geral: { nome: 'Todos', bandeira: '🌎' },
}

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
      <div className="flex">
        {paises.map((pais) => (
          <button
            key={pais}
            type="button"
            onClick={() => onAbaChange(pais)}
            className={`flex-1 py-3 text-center text-sm font-medium transition-colors ${
              abaAtiva === pais ? 'border-b-2 border-[#0097b2] text-[#0097b2]' : 'text-gray-500'
            }`}
          >
            <span className="mr-1">{NOMES[/** @type {keyof typeof NOMES} */ (pais)]?.bandeira ?? '🌐'}</span>
            {NOMES[/** @type {keyof typeof NOMES} */ (pais)]?.nome ?? pais}
            {contadores[pais] !== undefined ? (
              <span className="ml-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs">{contadores[pais]}</span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  )
}
