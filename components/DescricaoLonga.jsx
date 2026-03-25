'use client'

/**
 * @param {{ descricao: string | null }} props
 */
export default function DescricaoLonga({ descricao }) {
  if (!descricao) return null

  const textoExibido =
    descricao.length > 350 ? `${descricao.substring(0, 350)}...` : descricao

  return <p className="text-sm leading-relaxed text-gray-600">{textoExibido}</p>
}
