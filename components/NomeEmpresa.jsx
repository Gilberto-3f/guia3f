'use client'

import NomeComVerificacao from '@/components/NomeComVerificacao'

/**
 * @param {{ nome: string, verificado?: boolean }} props
 */
export default function NomeEmpresa({ nome, verificado = false }) {
  return (
    <h1 className="text-xl font-bold text-gray-800">
      <NomeComVerificacao nome={nome} verificado={verificado} verificadoTipo="empresa" />
    </h1>
  )
}
