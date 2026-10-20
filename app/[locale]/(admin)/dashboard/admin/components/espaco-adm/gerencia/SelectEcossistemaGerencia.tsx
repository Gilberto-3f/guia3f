'use client'

type Opcao = { id: string; nome: string }

type Props = {
  id?: string
  value: string
  onChange: (id: string) => void
  opcoes: Opcao[]
  carregando?: boolean
  obrigatorio?: boolean
}

export function SelectEcossistemaGerencia({
  id = 'gerencia-ecossistema',
  value,
  onChange,
  opcoes,
  carregando = false,
  obrigatorio = true,
}: Props) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-gray-700">
        Cidade / região{obrigatorio ? ' *' : ''}
      </label>
      <select
        id={id}
        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={carregando || opcoes.length === 0}
      >
        <option value="">{carregando ? 'Carregando…' : 'Selecione o bloco'}</option>
        {opcoes.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nome}
          </option>
        ))}
      </select>
    </div>
  )
}
