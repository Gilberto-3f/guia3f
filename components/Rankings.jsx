'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, Award, Package } from 'lucide-react'
import { supabase } from '@/lib/supabase'

/** @typedef {{ nome?: string, marca?: string, categoria_drena?: string, total_buscas: number, foto_url?: string | null, id?: string }} RankingItem */

/** @typedef {'produtos' | 'marcas' | 'segmentos'} RankingTipo */

export default function Rankings() {
  const [tipo, setTipo] = useState(/** @type {RankingTipo} */ ('produtos'))
  const [ranking, setRanking] = useState(/** @type {RankingItem[]} */ ([]))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const carregarRanking = async () => {
      setLoading(true)
      try {
        let rows = /** @type {RankingItem[] | null} */ (null)

        switch (tipo) {
          case 'produtos': {
            const { data } = await supabase.from('produtos_mais_buscados').select('*')
            rows = /** @type {RankingItem[]} */ (data ?? [])
            break
          }
          case 'marcas': {
            const { data } = await supabase.from('marcas_mais_pesquisadas').select('*')
            rows = /** @type {RankingItem[]} */ (data ?? [])
            break
          }
          case 'segmentos': {
            const { data } = await supabase.from('segmentos_em_alta').select('*')
            rows = /** @type {RankingItem[]} */ (data ?? [])
            break
          }
          default:
            rows = []
        }

        setRanking(rows ?? [])
      } catch (e) {
        console.error('Erro ao carregar ranking:', e)
      } finally {
        setLoading(false)
      }
    }

    void carregarRanking()
  }, [tipo])

  const getIcon = () => {
    switch (tipo) {
      case 'produtos':
        return Package
      case 'marcas':
        return Award
      case 'segmentos':
        return TrendingUp
      default:
        return Package
    }
  }

  const getTitle = () => {
    switch (tipo) {
      case 'produtos':
        return 'Produtos mais buscados'
      case 'marcas':
        return 'Marcas mais pesquisadas'
      case 'segmentos':
        return 'Segmentos em alta'
      default:
        return 'Ranking'
    }
  }

  const getDisplayName = (item) => {
    switch (tipo) {
      case 'produtos':
        return item.nome
      case 'marcas':
        return item.marca
      case 'segmentos':
        return item.categoria_drena
      default:
        return ''
    }
  }

  const Icon = getIcon()

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Icon size={20} className="text-[#0097b2]" aria-hidden />
          <h3 className="font-semibold text-gray-800">{getTitle()}</h3>
        </div>

        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setTipo('produtos')}
            className={`rounded px-2 py-1 text-xs ${tipo === 'produtos' ? 'bg-[#0097b2] text-white' : 'text-gray-500'}`}
          >
            Produtos
          </button>
          <button
            type="button"
            onClick={() => setTipo('marcas')}
            className={`rounded px-2 py-1 text-xs ${tipo === 'marcas' ? 'bg-[#0097b2] text-white' : 'text-gray-500'}`}
          >
            Marcas
          </button>
          <button
            type="button"
            onClick={() => setTipo('segmentos')}
            className={`rounded px-2 py-1 text-xs ${tipo === 'segmentos' ? 'bg-[#0097b2] text-white' : 'text-gray-500'}`}
          >
            Segmentos
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-4 text-center text-gray-400">Carregando...</div>
      ) : ranking.length === 0 ? (
        <div className="py-4 text-center text-gray-400">Nenhum dado disponível</div>
      ) : (
        <div className="space-y-2">
          {ranking.map((item, index) => (
            <div key={`${getDisplayName(item) ?? index}-${index}`} className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="w-6 shrink-0 text-sm font-bold text-gray-400">#{index + 1}</span>
                <span className="truncate text-gray-700">{getDisplayName(item)}</span>
              </div>
              <span className="shrink-0 text-sm text-gray-500">{Number(item.total_buscas) || 0} buscas</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
