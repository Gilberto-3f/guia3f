'use client'

import { useRouter, useSearchParams } from 'next/navigation'

export type VerificacaoSubabaId = 'turistas' | 'profissionais' | 'empresas'

const opts: { id: VerificacaoSubabaId; label: string }[] = [
  { id: 'turistas', label: '👤 Turistas' },
  { id: 'profissionais', label: '🚗 Profis.' },
  { id: 'empresas', label: '🏢 Empresas' },
]

export function SubabasVerificacao({
  value,
  badges,
}: {
  value: VerificacaoSubabaId
  badges?: Record<VerificacaoSubabaId, number>
}) {
  const router = useRouter()
  const sp = useSearchParams()

  const set = (next: VerificacaoSubabaId) => {
    const params = new URLSearchParams(sp.toString())
    params.set('tab', 'cadastros')
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
            {o.label} {badges ? <span className="ml-1 text-xs">({badges[o.id] ?? 0})</span> : null}
          </button>
        )
      })}
    </div>
  )
}

