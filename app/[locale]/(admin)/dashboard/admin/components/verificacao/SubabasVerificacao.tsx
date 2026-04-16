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
    <div className="-mx-1 flex min-w-0 max-w-full flex-nowrap gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin] sm:flex-wrap sm:overflow-visible">
      {opts.map((o) => {
        const active = o.id === value
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => set(o.id)}
            className={[
              'shrink-0 rounded-xl px-3 py-2 text-sm font-semibold whitespace-nowrap transition',
              active ? 'bg-emerald-600 text-white shadow-sm' : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200',
            ].join(' ')}
          >
            {o.label} {badges ? <span className="ml-1 text-xs">({badges[o.id] ?? 0})</span> : null}
          </button>
        )
      })}
    </div>
  )
}

