'use client'

import { useRouter, useSearchParams } from 'next/navigation'

export type EspacoSubabaId = 'graficos' | 'empresas' | 'financeiro' | 'gerencia'

const opts: { id: EspacoSubabaId; label: string }[] = [
  { id: 'graficos', label: '📊 Gráficos ADM' },
  { id: 'empresas', label: '🏢 Empresas' },
  { id: 'financeiro', label: '💰 Financeiro' },
  { id: 'gerencia', label: '👥 Gerência' },
]

export function SubabasEspaco({ value }: { value: EspacoSubabaId }) {
  const router = useRouter()
  const sp = useSearchParams()

  const set = (next: EspacoSubabaId) => {
    const params = new URLSearchParams(sp.toString())
    params.set('tab', 'espaco-adm')
    params.set('sub', next)
    router.replace(`?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap gap-2">
      {opts.map((o) => {
        const active = o.id === value
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => set(o.id)}
            className={[
              'rounded-xl px-3 py-2 text-sm font-semibold transition',
              active ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100',
            ].join(' ')}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

