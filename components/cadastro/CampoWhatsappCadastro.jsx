'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  montarTelefoneComDdi,
  PAISES_TELEFONE_RECOMENDACAO,
  paisTelefonePorId,
} from '@/lib/paisesTelefoneRecomendacao'
import {
  formatarTelefoneLocal,
  placeholderTelefoneLocal,
} from '@/lib/formatarTelefoneCadastro'

/**
 * @param {{
 *   id: string
 *   label: import('react').ReactNode
 *   onChange: (phoneDigits: string) => void
 *   required?: boolean
 * }} props
 */
export default function CampoWhatsappCadastro({
  id,
  label,
  onChange,
  required = true,
}) {
  const [paisId, setPaisId] = useState('br')
  const [paisMenuAberto, setPaisMenuAberto] = useState(false)
  const [contatoLocal, setContatoLocal] = useState('')

  const pais = paisTelefonePorId(paisId)

  const atualizarTelefone = (novoPaisId, novoContatoLocal) => {
    const p = paisTelefonePorId(novoPaisId)
    onChange(montarTelefoneComDdi(p.ddi, novoContatoLocal))
  }

  const handleLocalChange = (raw) => {
    const formatado = formatarTelefoneLocal(paisId, raw)
    setContatoLocal(formatado)
    atualizarTelefone(paisId, formatado)
  }

  const placeholder =
    placeholderTelefoneLocal(paisId) ?? pais.placeholder

  const inputCls =
    'min-w-0 flex-1 rounded-lg bg-[#0097b2] px-3 py-3 text-sm text-white placeholder:text-white/70 outline-none'

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-[#001f3f]">
        {label}
      </label>
      <div className="flex gap-2">
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setPaisMenuAberto((v) => !v)}
            className="flex h-[46px] items-center gap-1 rounded-lg bg-[#0097b2] px-2.5 text-sm font-semibold text-white"
            aria-label={`País: ${pais.nome}`}
            aria-expanded={paisMenuAberto}
          >
            <span className="text-base leading-none">{pais.bandeira}</span>
            <span className="text-xs">+{pais.ddi}</span>
            <ChevronDown className="h-3.5 w-3.5 opacity-80" aria-hidden />
          </button>
          {paisMenuAberto ? (
            <ul className="absolute left-0 top-full z-10 mt-1 max-h-48 w-44 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              {PAISES_TELEFONE_RECOMENDACAO.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50"
                    onClick={() => {
                      setPaisId(p.id)
                      setPaisMenuAberto(false)
                      setContatoLocal('')
                      atualizarTelefone(p.id, '')
                    }}
                  >
                    <span aria-hidden>{p.bandeira}</span>
                    <span className="flex-1 truncate">{p.nome}</span>
                    <span className="text-xs text-gray-500">+{p.ddi}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required={required}
          placeholder={placeholder}
          value={contatoLocal}
          onChange={(e) => handleLocalChange(e.target.value)}
          className={inputCls}
        />
      </div>
    </div>
  )
}
