'use client'

/**
 * @param {{ nome: string }} props
 */
export default function NomeEmpresa({ nome }) {
  return <h1 className="text-xl font-bold text-gray-800">{nome}</h1>
}
