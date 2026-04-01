'use client'

/**
 * @param {{ texto: string | null }} props
 */
export default function DescricaoCurta({ texto }) {
  if (!texto?.trim()) return null
  const t = texto.length > 170 ? `${texto.slice(0, 170)}…` : texto
  return <p className="max-w-md text-left text-sm text-[#666666]">{t}</p>
}
