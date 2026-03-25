'use client'

/**
 * @param {{ texto: string | null }} props
 */
export default function DescricaoCurta({ texto }) {
  if (!texto?.trim()) return null
  const t = texto.length > 170 ? `${texto.slice(0, 170)}…` : texto
  return <p className="mx-auto max-w-md px-4 text-center text-sm text-[#666666]">{t}</p>
}
