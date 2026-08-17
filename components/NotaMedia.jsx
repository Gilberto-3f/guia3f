'use client'

import Estrelas from '@/components/Estrelas'

/**
 * @param {{ nota: number, total?: number }} props
 */
export default function NotaMedia({ nota }) {
  return (
    <div className="flex items-center">
      <Estrelas
        nota={nota}
        tamanho={22}
        notaClassName="text-base font-semibold text-[#001f3f]"
      />
    </div>
  )
}
