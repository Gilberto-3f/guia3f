'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { EcossistemaBloco } from '@/lib/ecossistemas'

type Props = {
  lista: EcossistemaBloco[]
  ativo: EcossistemaBloco | null
  podeTrocar: boolean
  onChange: (id: string) => void
}

export default function ChevronEcossistemaCanaisAdm({ lista, ativo, podeTrocar, onChange }: Props) {
  const t = useTranslations('Guia')
  const [aberto, setAberto] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [aberto])

  if (!ativo) return null

  const podeAbrir = podeTrocar && lista.length > 1

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        aria-label={t('ecoAria')}
        aria-expanded={podeAbrir ? aberto : undefined}
        aria-haspopup={podeAbrir ? 'listbox' : undefined}
        disabled={!podeAbrir}
        onClick={() => {
          if (podeAbrir) setAberto((v) => !v)
        }}
        className="inline-flex max-w-[12rem] items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-bold text-white sm:max-w-[16rem] sm:text-sm"
      >
        <span className="truncate">{ativo.nome}</span>
        {podeAbrir ? (
          <ChevronDown
            className={['h-3.5 w-3.5 shrink-0 transition-transform', aberto ? 'rotate-180' : ''].join(' ')}
            strokeWidth={2.5}
            aria-hidden
          />
        ) : null}
      </button>

      {aberto && podeAbrir ? (
        <ul
          role="listbox"
          className="absolute left-0 top-full z-[60] mt-1 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg"
        >
          {lista.map((eco) => {
            const selected = eco.id === ativo.id
            return (
              <li key={eco.id} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(eco.id)
                    setAberto(false)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-gray-50"
                >
                  <span className="min-w-0 flex-1 font-semibold text-gray-900">{eco.nome}</span>
                  <span className="shrink-0 text-[10px] font-bold uppercase text-[#0097b2]">
                    {eco.tipo === 'regiao' ? t('ecoTipoRegiao') : t('ecoTipoCidade')}
                  </span>
                  {selected ? <Check className="h-4 w-4 shrink-0 text-[#00D443]" strokeWidth={2.5} /> : null}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
