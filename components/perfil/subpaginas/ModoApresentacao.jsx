'use client'

/**
 * @param {{ onEscolher: (role: 'turista' | 'profissional' | 'empresa') => void }} props
 */
export default function ModoApresentacao({ onEscolher }) {
  const opcoes = [
    { role: /** @type {const} */ ('turista'), icon: '👤', label: 'Turista' },
    { role: /** @type {const} */ ('profissional'), icon: '🚗', label: 'Profissional' },
    { role: /** @type {const} */ ('empresa'), icon: '🏢', label: 'Empresa' },
  ]

  return (
    <div className="grid gap-3 px-1">
      <p className="text-sm text-gray-600">Simula a navegação como outro tipo de perfil (apenas neste dispositivo).</p>
      {opcoes.map((o) => (
        <button
          key={o.role}
          type="button"
          onClick={() => onEscolher(o.role)}
          className="flex items-center gap-3 rounded-xl border border-gray-200 p-4 text-left font-medium transition hover:border-[#0097b2]/50 hover:bg-gray-50"
        >
          <span className="text-2xl" aria-hidden>
            {o.icon}
          </span>
          {o.label}
        </button>
      ))}
    </div>
  )
}
