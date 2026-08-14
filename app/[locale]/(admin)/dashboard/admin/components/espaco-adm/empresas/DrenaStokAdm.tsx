'use client'

import { useState } from 'react'
import { History, ShoppingCart } from 'lucide-react'
import PastaEstatistica from '@/app/[locale]/(app-shell)/dashboard/empresa/components/estatisticas-mercado/PastaEstatistica'
import AbaComprasCde from '@/app/[locale]/(app-shell)/dashboard/empresa/components/drena-stok/AbaComprasCde'
import AbaHistorico from '@/app/[locale]/(app-shell)/dashboard/empresa/components/drena-stok/AbaHistorico'

/** Drena-Stok agregado (Compras CDE + Histórico) para acompanhamento ADM. */
export function DrenaStokAdm() {
  const [pastaAberta, setPastaAberta] = useState<string | null>(null)

  const togglePasta = (id: string) => {
    setPastaAberta((atual) => (atual === id ? null : id))
  }

  return (
    <div className="space-y-3">
      <p className="text-center text-xs text-gray-500">
        Resultados agregados do mercado Compras CDE — mesmos painéis das abas Compras CDE e Histórico do
        Drena-Stok das empresas.
      </p>

      <PastaEstatistica
        id="drena-compras-cde"
        titulo="Compras CDE"
        icon={ShoppingCart}
        aberto={pastaAberta === 'drena-compras-cde'}
        onToggle={() => togglePasta('drena-compras-cde')}
        controlado
      >
        <AbaComprasCde />
      </PastaEstatistica>

      <PastaEstatistica
        id="drena-historico"
        titulo="Histórico"
        icon={History}
        aberto={pastaAberta === 'drena-historico'}
        onToggle={() => togglePasta('drena-historico')}
        controlado
      >
        <AbaHistorico />
      </PastaEstatistica>
    </div>
  )
}
