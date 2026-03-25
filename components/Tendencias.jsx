'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { TrendingUp, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'

/** @typedef {{ id: string, nome: string, marca: string | null, categoria_drena: string | null, foto_url: string | null, buscas_24h: number }} Tendencia */

export default function Tendencias() {
  const [tendencias, setTendencias] = useState(/** @type {Tendencia[]} */ ([]))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const carregarTendencias = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase.from('tendencias_24h').select('*')

        if (error) throw error

        const lista =
          data?.map((row) => ({
            id: String(row.id),
            nome: String(row.nome ?? ''),
            marca: row.marca != null ? String(row.marca) : null,
            categoria_drena: row.categoria_drena != null ? String(row.categoria_drena) : null,
            foto_url: row.foto_url != null ? String(row.foto_url) : null,
            buscas_24h: Number(row.buscas_24h) || 0,
          })) ?? []

        setTendencias(lista)
      } catch (e) {
        console.error('Erro ao carregar tendências:', e)
      } finally {
        setLoading(false)
      }
    }

    void carregarTendencias()
  }, [])

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <TrendingUp size={20} className="text-[#FF9800]" aria-hidden />
        <h3 className="font-semibold text-gray-800">Tendências recentes</h3>
        <div className="ml-auto flex items-center gap-1">
          <Clock size={12} className="text-gray-400" aria-hidden />
          <span className="text-xs text-gray-400">Últimas 24h</span>
        </div>
      </div>

      {loading ? (
        <div className="py-4 text-center text-gray-400">Carregando...</div>
      ) : tendencias.length === 0 ? (
        <div className="py-4 text-center text-gray-400">Nenhuma tendência no momento</div>
      ) : (
        <div className="space-y-3">
          {tendencias.map((item) => (
            <div key={item.id} className="flex items-center gap-3">
              {item.foto_url ? (
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg">
                  <Image src={item.foto_url} alt={item.nome} fill className="object-cover" sizes="48px" />
                </div>
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                  <span className="text-xs text-gray-400">Sem foto</span>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h4 className="font-medium text-gray-800">{item.nome}</h4>
                {item.marca ? <p className="text-xs text-gray-500">{item.marca}</p> : null}
                {item.categoria_drena ? <p className="text-xs text-gray-400">{item.categoria_drena}</p> : null}
              </div>
              <div className="shrink-0 text-right">
                <div className="flex items-center justify-end gap-1 text-green-600">
                  <TrendingUp size={12} aria-hidden />
                  <span className="text-sm font-medium">{item.buscas_24h}</span>
                </div>
                <span className="text-xs text-gray-400">buscas</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
