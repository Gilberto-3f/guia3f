'use client'

import Estrelas from '@/components/Estrelas'

/**
 * @param {{ nota: number, total: number }} props
 */
export default function NotaMedia({ nota, total }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Estrelas nota={nota} tamanho={16} />
      <span className="text-sm text-gray-500">({total} avaliações)</span>
    </div>
  )
}
