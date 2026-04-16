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
    <div className="-mx-1 flex min-w-0 max-w-full flex-nowrap gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin] sm:flex-wrap sm:overflow-visible">
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
                'shrink-0 rounded-xl px-3 py-2 text-sm font-semibold whitespace-nowrap transition',
                active ? 'bg-emerald-600 text-white shadow-sm' : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200',
              ].join(' ')}
            >
              {o.label} {typeof badges?.[o.id] === 'number' ? <span className="ml-1 text-xs">({badges?.[o.id]})</span> : null}
            </button>
          )
        })}
    </div>
  )
}
