'use client'

export function StatusBadge({ tone, children }: { tone: 'ok' | 'warn' | 'danger'; children: React.ReactNode }) {
  const cls =
    tone === 'ok'
      ? 'bg-emerald-100 text-emerald-700'
      : tone === 'warn'
        ? 'bg-amber-100 text-amber-700'
        : 'bg-rose-100 text-rose-700'
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>
}

