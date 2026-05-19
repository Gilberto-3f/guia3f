'use client'

import { useState } from 'react'
import { Briefcase, ShoppingBag } from 'lucide-react'

/**
 * Histórico de compras com abas Serviços e Compras.
 */
export default function HistoricoCompras() {
  const [aba, setAba] = useState(/** @type {'servicos' | 'compras'} */ ('servicos'))

  const tabCls = (ativo) =>
    `flex-1 py-2.5 text-center text-xs font-semibold tracking-wide transition-colors ${
      ativo ? 'border-b-[3px] border-[#0097b2] text-[#0097b2]' : 'border-b-[3px] border-transparent text-gray-500'
    }`

  return (
    <div className="px-1 pb-4">
      <div className="mb-1 flex border-b border-gray-200">
        <button type="button" className={tabCls(aba === 'servicos')} onClick={() => setAba('servicos')}>
          SERVIÇOS
        </button>
        <button type="button" className={tabCls(aba === 'compras')} onClick={() => setAba('compras')}>
          COMPRAS
        </button>
      </div>

      {aba === 'servicos' ? (
        <div className="mt-4">
          <div className="mb-3 flex items-center gap-2 text-sm text-gray-600">
            <Briefcase className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
            <span>Serviços de profissionais contratados pelo app.</span>
          </div>
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-10 text-center text-sm text-gray-400">
            Nenhum serviço contratado ainda
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <div className="mb-3 flex items-center gap-2 text-sm text-gray-600">
            <ShoppingBag className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
            <span>Tickets e reservas feitas pelo aplicativo.</span>
          </div>
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-10 text-center text-sm text-gray-400">
            Nenhuma compra registrada ainda
          </div>
        </div>
      )}
    </div>
  )
}
