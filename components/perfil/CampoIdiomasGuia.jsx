'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Plus, Trash2 } from 'lucide-react'
import { IDIOMAS_GUIA, labelIdiomaGuia } from '@/lib/idiomasGuia'

const COR = '#0097b2'

/**
 * Cadastro de idiomas do Guia: uma linha por idioma (bandeira + chevron),
 * botão + para adicionar novos campos.
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
  titulo = 'Idiomas em que você é fluente',
  dica = 'Escolha a bandeira do país de cada idioma. Esses dados alimentam o filtro da Mobilidade para turistas.',
}) {
  const lista = Array.isArray(value) && value.length > 0 ? value : ['pt']
  const [abertoIdx, setAbertoIdx] = useState(/** @type {number | null} */ (null))
  const rootRef = useRef(/** @type {HTMLDivElement | null} */ (null))

  useEffect(() => {
    if (!Array.isArray(value) || value.length === 0) {
      onChange(['pt'])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só na montagem / value vazio
  }, [])

  useEffect(() => {
    if (abertoIdx == null) return
    const onDoc = (e) => {
      if (!rootRef.current?.contains(/** @type {Node} */ (e.target))) {
        setAbertoIdx(null)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [abertoIdx])

  const usados = new Set(lista)
  const disponiveisParaNovo = IDIOMAS_GUIA.filter((i) => !usados.has(i.codigo))

  const setAt = (idx, codigo) => {
    const next = [...lista]
    next[idx] = codigo
    // remove duplicatas acidentais
    const seen = new Set()
    const limpo = []
    for (const c of next) {
      if (!c || seen.has(c)) continue
      seen.add(c)
      limpo.push(c)
    }
    onChange(limpo.length ? limpo : ['pt'])
    setAbertoIdx(null)
  }

  const adicionar = () => {
    if (disabled || disponiveisParaNovo.length === 0) return
    onChange([...lista, disponiveisParaNovo[0].codigo])
  }

  const remover = (idx) => {
    if (disabled || lista.length <= 1) return
    const next = lista.filter((_, i) => i !== idx)
    onChange(next.length ? next : ['pt'])
    setAbertoIdx(null)
  }

  const meta = (codigo) => IDIOMAS_GUIA.find((i) => i.codigo === codigo)

  return (
    <div ref={rootRef}>
      <p className="text-xs font-medium text-gray-800">{titulo}</p>
      {dica ? <p className="mt-1 text-[11px] leading-relaxed text-gray-500">{dica}</p> : null}

      <div className="mt-2 flex items-start gap-2">
        <div className="min-w-0 flex-1 space-y-2">
          {lista.map((codigo, idx) => {
            const item = meta(codigo)
            const aberto = abertoIdx === idx
            const opcoes = IDIOMAS_GUIA.filter(
              (i) => i.codigo === codigo || !usados.has(i.codigo),
            )
            return (
              <div key={`${codigo}-${idx}`} className="relative">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setAbertoIdx(aberto ? null : idx)}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left text-sm disabled:opacity-50"
                    aria-expanded={aberto}
                    aria-haspopup="listbox"
                  >
                    <span className="text-xl leading-none" aria-hidden>
                      {item?.bandeira ?? '🏳️'}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-semibold text-gray-900">
                      {item?.label ?? labelIdiomaGuia(codigo)}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 transition-transform ${aberto ? 'rotate-180' : ''}`}
                      style={{ color: COR }}
                      aria-hidden
                    />
                  </button>
                  {lista.length > 1 ? (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => remover(idx)}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-rose-500 hover:bg-rose-50 disabled:opacity-50"
                      aria-label="Remover idioma"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  ) : null}
                </div>

                {aberto ? (
                  <ul
                    role="listbox"
                    className="absolute left-0 right-0 z-20 mt-1 max-h-48 overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
                  >
                    {opcoes.map((opt) => (
                      <li key={opt.codigo} role="option" aria-selected={opt.codigo === codigo}>
                        <button
                          type="button"
                          onClick={() => setAt(idx, opt.codigo)}
                          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[#0097b2]/10 ${
                            opt.codigo === codigo ? 'bg-[#0097b2]/10 font-semibold' : ''
                          }`}
                        >
                          <span className="text-lg" aria-hidden>
                            {opt.bandeira}
                          </span>
                          {opt.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )
          })}
        </div>

        <button
          type="button"
          disabled={disabled || disponiveisParaNovo.length === 0}
          onClick={adicionar}
          className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-sm disabled:opacity-40"
          style={{ backgroundColor: COR }}
          aria-label="Adicionar idioma"
          title="Adicionar outro idioma"
        >
          <Plus className="h-5 w-5 text-white" strokeWidth={2.5} aria-hidden />
        </button>
      </div>
    </div>
  )
}
