'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  mapRotaTabeladaRow,
  type CategoriaTabeladoId,
  type CidadeOrigemTabeladoId,
  type RotaTabelada,
} from '@/lib/servicosTabeladosCatalogo'

export type NovaRotaTabeladaInput = {
  categoria: CategoriaTabeladoId
  cidadeOrigem: CidadeOrigemTabeladoId
  pontoPartida: string
  destinoFinal: string
  valorRota: number
}

export function useServicosTabeladosAdm() {
  const [rotas, setRotas] = useState<RotaTabelada[]>([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('servicos_tabelados_rotas')
        .select('*')
        .eq('ativo', true)
        .order('cidade_origem', { ascending: true })
        .order('destino_final', { ascending: true })
      if (error) throw error
      setRotas((data ?? []).map((r) => mapRotaTabeladaRow(r as Record<string, unknown>)))
    } catch (err) {
      console.error(err)
      setRotas([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const salvarRota = useCallback(
    async (input: NovaRotaTabeladaInput, adminId: string) => {
      const destino = input.destinoFinal.trim()
      if (!destino) return { success: false, error: new Error('Destino final obrigatório') }
      if (!Number.isFinite(input.valorRota) || input.valorRota < 0) {
        return { success: false, error: new Error('Valor da rota inválido') }
      }

      setSalvando(true)
      try {
        const { error } = await supabase.from('servicos_tabelados_rotas').insert({
          categoria: input.categoria,
          cidade_origem: input.cidadeOrigem,
          ponto_partida: input.pontoPartida.trim(),
          destino_final: destino,
          valor_rota: input.valorRota,
          criado_por: adminId,
          ativo: true,
          updated_at: new Date().toISOString(),
        })
        if (error) throw error
        await carregar()
        return { success: true }
      } catch (err) {
        return { success: false, error: err }
      } finally {
        setSalvando(false)
      }
    },
    [carregar],
  )

  const excluirRota = useCallback(
    async (id: string) => {
      setSalvando(true)
      try {
        const { error } = await supabase
          .from('servicos_tabelados_rotas')
          .update({ ativo: false, updated_at: new Date().toISOString() })
          .eq('id', id)
        if (error) throw error
        await carregar()
        return { success: true }
      } catch (err) {
        return { success: false, error: err }
      } finally {
        setSalvando(false)
      }
    },
    [carregar],
  )

  return { rotas, loading, salvando, salvarRota, excluirRota, refetch: carregar }
}
