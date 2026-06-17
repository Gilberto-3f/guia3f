'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, ChevronDown, MapPin } from 'lucide-react'
import { useServicosTabeladosProfissional } from '@/hooks/useServicosTabeladosProfissional'
import {
  CIDADES_ORIGEM_TABELADO,
  labelCategoriaTabelado,
  ordenarCidadesTabeladas,
} from '@/lib/servicosTabeladosCatalogo'

const COR_ICONE_ROTA = '#00D443'

function limparPontoPartida(texto) {
  return String(texto ?? '')
    .replace(/^\s*→\s*/u, '')
    .replace(/\s*→\s*$/u, '')
    .trim()
}

function SubtituloCategoria({ categoria }) {
  if (!categoria) return null
  return (
    <p className="text-sm font-semibold text-[#0097b2]">{labelCategoriaTabelado(categoria)}</p>
  )
}

function LinhaRota({ rota }) {
  const partida = limparPontoPartida(rota.pontoPartida)
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-3">
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <ArrowRight className="h-4 w-4 shrink-0" style={{ color: COR_ICONE_ROTA }} strokeWidth={2.25} aria-hidden />
          <span className="min-w-0 truncate">{partida}</span>
        </p>
        <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <MapPin className="h-4 w-4 shrink-0" style={{ color: COR_ICONE_ROTA }} strokeWidth={2.25} aria-hidden />
          <span className="min-w-0 truncate">{rota.destinoFinal}</span>
        </p>
      </div>
      <p className="shrink-0 text-sm font-bold text-[#0097b2]">
        R$ {rota.valorRota.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
      </p>
    </li>
  )
}

/**
 * @param {{ usuarioId: string | null, placaVermelha?: boolean }} props
 */
export default function TabelaValores({ usuarioId, placaVermelha = false }) {
  const { rotas, loading, categoria, cidadeCadastro } = useServicosTabeladosProfissional(
    usuarioId,
    placaVermelha,
  )
  const [pastasAbertas, setPastasAbertas] = useState(/** @type {Record<string, boolean>} */ ({}))

  const porCidade = useMemo(() => {
    return rotas.reduce((acc, rota) => {
      const key = rota.cidadeOrigem
      if (!acc[key]) acc[key] = []
      acc[key].push(rota)
      return acc
    }, /** @type {Record<string, typeof rotas>} */ ({}))
  }, [rotas])

  const cidadesOrdenadas = useMemo(
    () => ordenarCidadesTabeladas(Object.keys(porCidade), cidadeCadastro),
    [porCidade, cidadeCadastro],
  )

  useEffect(() => {
    if (!cidadesOrdenadas.length) return
    setPastasAbertas((atual) => {
      const next = { ...atual }
      let alterou = false
      for (const id of cidadesOrdenadas) {
        if (next[id] === undefined) {
          next[id] = id === cidadesOrdenadas[0]
          alterou = true
        }
      }
      return alterou ? next : atual
    })
  }, [cidadesOrdenadas.join(',')])

  const togglePasta = (cidadeId) => {
    setPastasAbertas((p) => ({ ...p, [cidadeId]: !p[cidadeId] }))
  }

  if (!placaVermelha) {
    return (
      <div className="space-y-4">
        <SubtituloCategoria categoria={categoria} />
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-6 text-center text-sm text-amber-800">
          Serviços tabelados disponíveis apenas para profissionais credenciados (placa vermelha).
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <SubtituloCategoria categoria={categoria} />
        <div className="space-y-2 py-2" aria-busy="true">
          <div className="h-14 animate-pulse rounded-xl bg-gray-100" />
          <div className="h-14 animate-pulse rounded-xl bg-gray-100" />
        </div>
      </div>
    )
  }

  if (!categoria) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-8 text-center text-sm text-gray-500">
          Categoria não mapeada para serviços tabelados. Entre em contato com o suporte.
        </div>
      </div>
    )
  }

  if (rotas.length === 0) {
    return (
      <div className="space-y-4">
        <SubtituloCategoria categoria={categoria} />
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-8 text-center text-sm text-gray-500">
          Nenhuma rota tabelada cadastrada para sua categoria no momento.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <SubtituloCategoria categoria={categoria} />

      <div className="space-y-3">
        {cidadesOrdenadas.map((cidadeId) => {
          const lista = porCidade[cidadeId] ?? []
          const meta = CIDADES_ORIGEM_TABELADO[/** @type {keyof typeof CIDADES_ORIGEM_TABELADO} */ (cidadeId)]
          const aberta = pastasAbertas[cidadeId] ?? false
          return (
            <section key={cidadeId} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <button
                type="button"
                onClick={() => togglePasta(cidadeId)}
                className="flex w-full items-center justify-between gap-2 bg-[#0097b2] px-3 py-2.5 text-left text-sm font-bold text-white transition hover:brightness-105"
                aria-expanded={aberta}
              >
                <span className="min-w-0 truncate">{meta?.label ?? cidadeId}</span>
                <ChevronDown
                  className={`h-5 w-5 shrink-0 transition-transform duration-200 ${aberta ? 'rotate-180' : ''}`}
                  strokeWidth={2.25}
                  aria-hidden
                />
              </button>
              {aberta ? (
                <ul className="divide-y divide-gray-100">
                  {lista.map((rota) => (
                    <LinhaRota key={rota.id} rota={rota} />
                  ))}
                </ul>
              ) : null}
            </section>
          )
        })}
      </div>
    </div>
  )
}
