'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { EcossistemaBloco } from '@/lib/ecossistemas'

const inputChip =
  'rounded-full px-3 py-1.5 text-sm font-semibold transition border'

export function useEcossistemasCadastro() {
  const [lista, setLista] = useState<EcossistemaBloco[]>([])
  const [ids, setIds] = useState<string[]>([])
  const [carregou, setCarregou] = useState(false)

  useEffect(() => {
    let cancel = false
    ;(async () => {
      try {
        const res = await fetch('/api/ecossistemas')
        const json = (await res.json().catch(() => ({}))) as {
          ecossistemas?: EcossistemaBloco[]
        }
        if (cancel) return
        const ecos = Array.isArray(json.ecossistemas) ? json.ecossistemas : []
        setLista(ecos)
        const padrao = ecos.find((e) => e.padrao)?.id ?? ecos[0]?.id
        if (padrao) {
          setIds((prev) => (prev.length > 0 ? prev : [padrao]))
        }
      } catch {
        if (!cancel) setLista([])
      } finally {
        if (!cancel) setCarregou(true)
      }
    })()
    return () => {
      cancel = true
    }
  }, [])

  return { lista, ids, setIds, carregou }
}

export function CampoEcossistemasCadastro({
  lista,
  value,
  onChange,
  label,
  hint,
}: {
  lista: EcossistemaBloco[]
  value: string[]
  onChange: (ids: string[]) => void
  label: string
  hint?: string
}) {
  const t = useTranslations('Cadastro')
  if (lista.length === 0) return null

  const toggle = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter((x) => x !== id))
    } else {
      onChange([...value, id])
    }
  }

  return (
    <div>
      <p className="mb-1 block text-sm font-medium text-[#001f3f]">{label}</p>
      {hint ? <p className="mb-2 text-xs text-[#001f3f]/80">{hint}</p> : null}
      <div className="flex flex-wrap gap-1.5">
        {lista.map((eco) => {
          const on = value.includes(eco.id)
          return (
            <button
              key={eco.id}
              type="button"
              onClick={() => toggle(eco.id)}
              className={[
                inputChip,
                on
                  ? 'border-transparent bg-[#00D443] text-white'
                  : 'border-white/40 bg-[#0097b2] text-white',
              ].join(' ')}
            >
              {eco.nome}
              <span className="ml-1 text-[10px] font-bold uppercase opacity-80">
                {eco.tipo === 'regiao' ? t('ecoTipoRegiao') : t('ecoTipoCidade')}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
