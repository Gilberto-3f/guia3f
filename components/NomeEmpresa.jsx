'use client'

/**
 * Nome fantasia da empresa com bandeira do país de localização.
 * @param {{ nome: string, bandeira?: string | null }} props
 */
export default function NomeEmpresa({ nome, bandeira = null }) {
  return (
    <h1 className="text-xl font-bold text-gray-800">
      <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
        {bandeira ? (
          <span className="shrink-0 text-xl leading-none" aria-hidden>
            {bandeira}
          </span>
        ) : null}
        <span className="min-w-0 truncate">{nome}</span>
      </span>
    </h1>
  )
}
