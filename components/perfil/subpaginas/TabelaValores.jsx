'use client'

import { useServicosTabeladosProfissional } from '@/hooks/useServicosTabeladosProfissional'
import { CIDADES_ORIGEM_TABELADO } from '@/lib/servicosTabeladosCatalogo'

/**
 * @param {{ usuarioId: string | null, placaVermelha?: boolean }} props
 */
export default function TabelaValores({ usuarioId, placaVermelha = false }) {
  const { rotas, loading, categoria } = useServicosTabeladosProfissional(usuarioId, placaVermelha)

  if (!placaVermelha) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-6 text-center text-sm text-amber-800">
        Serviços tabelados disponíveis apenas para profissionais credenciados (placa vermelha).
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-2 py-4" aria-busy="true">
        <div className="h-14 animate-pulse rounded-xl bg-gray-100" />
        <div className="h-14 animate-pulse rounded-xl bg-gray-100" />
      </div>
    )
  }

  if (!categoria) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-8 text-center text-sm text-gray-500">
        Categoria não mapeada para serviços tabelados. Entre em contato com o suporte.
      </div>
    )
  }

  if (rotas.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-8 text-center text-sm text-gray-500">
        Nenhuma rota tabelada cadastrada para sua categoria no momento.
      </div>
    )
  }

  const porCidade = rotas.reduce((acc, rota) => {
    const key = rota.cidadeOrigem
    if (!acc[key]) acc[key] = []
    acc[key].push(rota)
    return acc
  }, /** @type {Record<string, typeof rotas>} */ ({}))

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Valores de referência para deslocamento (tickets e ingressos são negociados à parte). Sincronizado com o painel
        administrativo.
      </p>

      {Object.entries(porCidade).map(([cidadeId, lista]) => {
        const meta = CIDADES_ORIGEM_TABELADO[/** @type {keyof typeof CIDADES_ORIGEM_TABELADO} */ (cidadeId)]
        return (
          <section key={cidadeId} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <h3 className="bg-[#0097b2] px-3 py-2 text-sm font-bold text-white">{meta?.label ?? cidadeId}</h3>
            <ul className="divide-y divide-gray-100">
              {lista.map((rota) => (
                <li key={rota.id} className="flex items-center justify-between gap-3 px-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">
                      {rota.pontoPartida} → {rota.destinoFinal}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-bold text-[#0097b2]">
                    R$ {rota.valorRota.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
