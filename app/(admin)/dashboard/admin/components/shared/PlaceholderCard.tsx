'use client'

export function PlaceholderCard({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-bold text-gray-900">{title}</div>
      <div className="mt-2 text-sm text-gray-600">{children ?? 'Módulo em desenvolvimento'}</div>
    </div>
  )
}

