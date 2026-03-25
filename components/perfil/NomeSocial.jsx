'use client'

/**
 * @param {{ nome: string }} props
 */
export default function NomeSocial({ nome }) {
  return <h1 className="text-center text-2xl font-bold text-[#001f3f]">{nome}</h1>
}
