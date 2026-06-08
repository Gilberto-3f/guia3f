'use client'

interface Opcao<T extends string> {
  valor: T
  rotulo: string
}

interface Props<T extends string> {
  rotulo: string
  valor: T
  opcoes: Opcao<T>[]
  onChange: (v: T) => void
}

export default function FiltroSelectMercado<T extends string>({ rotulo, valor, opcoes, onChange }: Props<T>) {
  return (
    <label className="flex flex-col gap-1 text-xs text-gray-600">
      <span className="font-medium">{rotulo}</span>
      <select
        value={valor}
        onChange={(e) => onChange(e.target.value as T)}
        className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm text-[#001f3f]"
      >
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
    </label>
  )
}
