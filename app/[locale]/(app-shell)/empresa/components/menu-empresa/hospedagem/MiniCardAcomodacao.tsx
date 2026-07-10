'use client'

import { Copy, Pencil, Trash2 } from 'lucide-react'
import {
  formatarValorDiaria,
  rotuloAcomodacaoResumo,
  type HospedagemAcomodacaoRow,
} from '@/lib/hospedagemAcomodacoesCatalogo'

type Props = {
  item: HospedagemAcomodacaoRow
  onEditar: () => void
  onDuplicar: () => void
  onExcluir: () => void
  excluindo?: boolean
}

export default function MiniCardAcomodacao({
  item,
  onEditar,
  onDuplicar,
  onExcluir,
  excluindo = false,
}: Props) {
  const capa = item.fotos[0] ?? null

  return (
    <article className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex gap-3 p-3">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-gray-100">
          {capa ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={capa} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-400">
              Sem foto
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-semibold text-[#001f3f]">
            {rotuloAcomodacaoResumo(item)}
          </p>
          <p className="mt-1 text-sm font-bold text-[#0097b2]">
            {formatarValorDiaria(Number(item.valor_diaria))}
            <span className="font-normal text-gray-500"> / diária</span>
          </p>
          <p className="mt-0.5 text-xs text-gray-500">Até {item.capacidade_pessoas} pessoa(s)</p>
        </div>
      </div>
      <div className="flex border-t border-gray-100">
        <button
          type="button"
          onClick={onEditar}
          className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-[#0097b2] hover:bg-[#0097b2]/5"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden />
          Editar
        </button>
        <button
          type="button"
          onClick={onDuplicar}
          className="flex flex-1 items-center justify-center gap-1.5 border-l border-gray-100 py-2.5 text-xs font-semibold text-[#001f3f] hover:bg-gray-50"
        >
          <Copy className="h-3.5 w-3.5" aria-hidden />
          Duplicar
        </button>
        <button
          type="button"
          onClick={onExcluir}
          disabled={excluindo}
          className="flex flex-1 items-center justify-center gap-1.5 border-l border-gray-100 py-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          Excluir
        </button>
      </div>
    </article>
  )
}
