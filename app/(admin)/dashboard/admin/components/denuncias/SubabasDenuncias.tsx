'use client'

export type DenunciaSubabaId = 'turistas' | 'profissionais' | 'empresas'

export default function SubabasDenuncias({
  perfilAtivo,
  onPerfilChange,
  podeVerProfissionais,
  podeVerEmpresas,
  badges,
}: {
  perfilAtivo: DenunciaSubabaId
  onPerfilChange: (p: DenunciaSubabaId) => void
  podeVerProfissionais: boolean
  podeVerEmpresas: boolean
  badges?: Partial<Record<DenunciaSubabaId, number>>
}) {
  const options: Array<{ id: DenunciaSubabaId; label: string; hidden?: boolean }> = [
    { id: 'turistas', label: 'Turistas' },
    { id: 'profissionais', label: 'Profissionais', hidden: !podeVerProfissionais },
    { id: 'empresas', label: 'Empresas', hidden: !podeVerEmpresas },
  ]
  return (
    <div className="flex flex-wrap gap-2">
      {options
        .filter((o) => !o.hidden)
        .map((o) => {
          const active = o.id === perfilAtivo
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onPerfilChange(o.id)}
            className={[
              'rounded-xl px-3 py-2 text-sm font-semibold transition',
                active ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100',
            ].join(' ')}
          >
              {o.label} {typeof badges?.[o.id] === 'number' ? <span className="ml-1 text-xs">({badges?.[o.id]})</span> : null}
          </button>
        )
        })}
    </div>
  )
}
