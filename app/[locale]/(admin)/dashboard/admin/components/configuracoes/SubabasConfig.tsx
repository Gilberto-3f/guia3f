'use client'

import { useRouter, useSearchParams } from 'next/navigation'

export type ConfigSubabaId = 'apis' | 'logs' | 'geral' | 'seguranca'

const opts: { id: ConfigSubabaId; label: string }[] = [
  { id: 'apis', label: '🔌 APIs' },
  { id: 'logs', label: '📋 Logs' },
  { id: 'geral', label: '⚙️ Geral' },
  { id: 'seguranca', label: '🔒 Seg.' },
]

export function SubabasConfig({ value }: { value: ConfigSubabaId }) {
  const router = useRouter()
  const sp = useSearchParams()

  const set = (next: ConfigSubabaId) => {
    const params = new URLSearchParams(sp.toString())
    params.set('tab', 'configuracoes')
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

