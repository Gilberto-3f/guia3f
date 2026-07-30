'use client'

import { IDIOMAS_GUIA, toggleIdiomaGuia } from '@/lib/idiomasGuia'

/**
 * Multi-seleção de idiomas do Guia de Turismo.
 * @param {{
 *   value: string[]
 *   onChange: (next: string[]) => void
 *   disabled?: boolean
 *   titulo?: string
 *   dica?: string
 * }} props
 */
export default function CampoIdiomasGuia({
  value = [],
  onChange,
  disabled = false,
  titulo = 'Idiomas que você atende',
  dica = 'Marque os idiomas em que consegue acompanhar o turista. Isso ajuda o matching na Mobilidade.',
}) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-800">{titulo}</p>
      {dica ? <p className="mt-1 text-[11px] leading-relaxed text-gray-500">{dica}</p> : null}
      <div className="mt-2 flex flex-wrap gap-2">
        {IDIOMAS_GUIA.map((item) => {
          const ativo = value.includes(item.codigo)
          return (
            <button
              key={item.codigo}
              type="button"
              disabled={disabled}
              onClick={() => onChange(toggleIdiomaGuia(value, item.codigo))}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                ativo
                  ? 'bg-[#0097b2] text-white ring-2 ring-[#0097b2]/40'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              } disabled:opacity-50`}
              aria-pressed={ativo}
            >
              <span aria-hidden>{item.bandeira}</span>
              {item.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
