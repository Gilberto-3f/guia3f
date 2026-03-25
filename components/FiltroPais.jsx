'use client'

const paises = [
  { id: 'foz', nome: 'Brasil', bandeira: '🇧🇷' },
  { id: 'cde', nome: 'Paraguai', bandeira: '🇵🇾' },
  { id: 'puerto', nome: 'Argentina', bandeira: '🇦🇷' },
]

/**
 * @param {{ paisSelecionado: string, onPaisChange: (pais: string) => void }} props
 */
export default function FiltroPais({ paisSelecionado, onPaisChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto border-b border-gray-100 bg-white p-4">
      {paises.map((pais) => (
        <button
          key={pais.id}
          type="button"
          onClick={() => onPaisChange(pais.id)}
          className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            paisSelecionado === pais.id
              ? 'bg-[#0097b2] text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <span className="mr-1">{pais.bandeira}</span>
          {pais.nome}
        </button>
      ))}
    </div>
  )
}
