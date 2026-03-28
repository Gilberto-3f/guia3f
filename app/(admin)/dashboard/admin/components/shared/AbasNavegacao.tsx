'use client'

export const ABAS_PRINCIPAIS = ['visao-geral', 'cadastros', 'denuncias', 'espaco-adm', 'configuracoes'] as const
export type AbaPrincipalId = (typeof ABAS_PRINCIPAIS)[number]

const labels: Record<AbaPrincipalId, string> = {
  'visao-geral': '📊 Visão Geral',
  cadastros: '✅ Cadastros',
  denuncias: '⚠️ Denúncias',
  'espaco-adm': '👑 Espaço ADM',
  configuracoes: '⚙️ Configurações',
}

export function AbasNavegacao({
  value,
  onChange,
}: {
  value: AbaPrincipalId
  onChange: (next: AbaPrincipalId) => void
}) {
  return (
    <div className="flex w-full flex-wrap gap-2">
      {ABAS_PRINCIPAIS.map((id) => {
        const active = id === value
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={[
              'rounded-xl px-3 py-2 text-sm font-semibold transition',
              active ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-100',
            ].join(' ')}
          >
            {labels[id]}
          </button>
        )
      })}
    </div>
  )
}

