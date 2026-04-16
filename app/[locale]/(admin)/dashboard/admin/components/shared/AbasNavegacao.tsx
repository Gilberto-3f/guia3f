'use client'

export const ABAS_PRINCIPAIS = ['visao-geral', 'cadastros', 'denuncias', 'espaco-adm', 'configuracoes'] as const
export type AbaPrincipalId = (typeof ABAS_PRINCIPAIS)[number]

const abas: { id: AbaPrincipalId; icon: string; label: string }[] = [
  { id: 'visao-geral', icon: '📊', label: 'Visão Geral' },
  { id: 'cadastros', icon: '✅', label: 'Cadastros' },
  { id: 'denuncias', icon: '⚠️', label: 'Denúncias' },
  { id: 'espaco-adm', icon: '👑', label: 'Espaço ADM' },
  { id: 'configuracoes', icon: '⚙️', label: 'Configurações' },
]

export function AbasNavegacao({
  value,
  onChange,
}: {
  value: AbaPrincipalId
  onChange: (next: AbaPrincipalId) => void
}) {
  return (
    <div className="-mx-1 flex w-full flex-nowrap gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
      {abas.map(({ id, icon, label }) => {
        const active = id === value
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-current={active ? 'page' : undefined}
            aria-label={label}
            title={label}
            className={[
              'shrink-0 rounded-xl px-3 py-2 text-sm font-semibold whitespace-nowrap transition',
              active
                ? 'bg-blue-600 text-white shadow-sm'
                : 'min-w-[2.5rem] bg-gray-100 text-gray-600 hover:bg-gray-200',
            ].join(' ')}
          >
            {active ? (
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden>{icon}</span>
                <span>{label.toUpperCase()}</span>
              </span>
            ) : (
              <span aria-hidden>{icon}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
