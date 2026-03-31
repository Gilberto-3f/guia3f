'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Anuncio, ReservaAnuncio } from '../types/empresa.types'

type VagaDisponivel = { vaga: string; disponivel: boolean }
type PeriodoReserva = '7d' | '15d' | '30d'

function asRecord(v: unknown) {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

export function usePublicidade(empresaId: string | null) {
  const [anuncios, setAnuncios] = useState<Anuncio[]>([])
  const [reservas, setReservas] = useState<ReservaAnuncio[]>([])
  const [vagasDisponiveis, setVagasDisponiveis] = useState<VagaDisponivel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchDados = useCallback(async () => {
    if (!empresaId) {
      setLoading(false)
      setAnuncios([])
      setReservas([])
      setVagasDisponiveis([])
      return
    }

    setLoading(true)
    setError(null)
    try {
      const [anRes, reRes, homeRes] = await Promise.all([
        supabase.from('anuncios').select('*').eq('empresa_id', empresaId).order('created_at', { ascending: false }),
        supabase.from('reservas_anuncios').select('*').eq('empresa_id', empresaId).order('reservado_em', { ascending: false }),
        supabase
          .from('anuncios')
          .select('localizacao, periodo_fim, status')
          .eq('tipo', 'home')
          .eq('status', 'ativo')
          .gte('periodo_fim', isoDate(new Date())),
      ])

      if (anRes.error) throw anRes.error
      if (reRes.error) throw reRes.error
      if (homeRes.error) throw homeRes.error

      const anunciosFmt: Anuncio[] = (anRes.data ?? []).map((row) => {
        const r = asRecord(row) ?? {}
        return {
          id: String(r.id ?? ''),
          tipo: (r.tipo === 'feed' ? 'feed' : 'home') as 'home' | 'feed',
          localizacao: r.localizacao != null ? String(r.localizacao) : null,
          imagem_url: String(r.imagem_url ?? ''),
          link_url: r.link_url != null ? String(r.link_url) : null,
          periodo_inicio: String(r.periodo_inicio ?? ''),
          periodo_fim: String(r.periodo_fim ?? ''),
          impressoes_contratadas: r.impressoes_contratadas != null ? Number(r.impressoes_contratadas) : null,
          impressoes_exibidas: Number(r.impressoes_exibidas) || 0,
          cliques: Number(r.cliques) || 0,
          status: String(r.status ?? 'ativo'),
        }
      })

      const reservasFmt: ReservaAnuncio[] = (reRes.data ?? []).map((row) => {
        const r = asRecord(row) ?? {}
        return {
          id: String(r.id ?? ''),
          vaga: String(r.vaga ?? ''),
          periodo_inicio: String(r.periodo_inicio ?? ''),
          periodo_fim: String(r.periodo_fim ?? ''),
          status: String(r.status ?? 'pendente'),
        }
      })

      const vagasOcupadas = new Set((homeRes.data ?? []).map((x) => {
        const r = asRecord(x) ?? {}
        return r.localizacao != null ? String(r.localizacao) : ''
      }))

      setAnuncios(anunciosFmt)
      setReservas(reservasFmt)
      setVagasDisponiveis(['vaga_1', 'vaga_2'].map((vaga) => ({ vaga, disponivel: !vagasOcupadas.has(vaga) })))
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro ao carregar publicidade'))
    } finally {
      setLoading(false)
    }
  }, [empresaId])

  const reservarVaga = useCallback(
    async (vaga: string, periodo: PeriodoReserva) => {
      if (!empresaId) throw new Error('Empresa não identificada')

      const duracaoDias = periodo === '7d' ? 7 : periodo === '15d' ? 15 : 30
      const inicio = new Date()
      const fim = new Date()
      fim.setDate(fim.getDate() + duracaoDias)

      const { data, error: insertError } = await supabase
        .from('reservas_anuncios')
        .insert({
          empresa_id: empresaId,
          vaga,
          periodo_inicio: isoDate(inicio),
          periodo_fim: isoDate(fim),
          status: 'pendente',
        })
        .select()
        .single()

      if (insertError) throw insertError
      await fetchDados()
      return data
    },
    [empresaId, fetchDados]
  )

  const cancelarReserva = useCallback(
    async (reservaId: string) => {
      const { error: upErr } = await supabase
        .from('reservas_anuncios')
        .update({ status: 'cancelada', cancelado_em: new Date().toISOString() })
        .eq('id', reservaId)
      if (upErr) throw upErr
      await fetchDados()
    },
    [fetchDados]
  )

  useEffect(() => {
    void fetchDados()
  }, [fetchDados])

  return useMemo(
    () => ({ anuncios, reservas, vagasDisponiveis, loading, error, reservarVaga, cancelarReserva, refetch: fetchDados }),
    [anuncios, reservas, vagasDisponiveis, loading, error, reservarVaga, cancelarReserva, fetchDados]
  )
}

