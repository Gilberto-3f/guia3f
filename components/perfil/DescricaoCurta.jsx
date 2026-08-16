'use client'

/**
 * @param {{ texto: string | null; centralizado?: boolean }} props
 */
export default function DescricaoCurta({ texto, centralizado = false }) {
  if (!texto?.trim()) return null
  const t = texto.length > 170 ? `${texto.slice(0, 170)}…` : texto
  return (
    <p
      className={`max-w-md text-sm text-[#666666] ${
        centralizado ? 'mx-auto text-center' : 'text-left'
      }`}
    >
      {t}
    </p>
  )
}
