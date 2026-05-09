'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Anuncio, ReservaAnuncio } from '../types/empresa.types'

type VagaDisponivel = { vaga: string; disponivel: boolean }
export type PeriodoReserva = '7d' | '15d' | '30d'

const MIME_ANUNCIO_HOME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])

function extensaoArquivoImagem(file: File): string {
  const t = (file.type || '').toLowerCase()
  if (t === 'image/jpeg' || t === 'image/jpg') return 'jpg'
  if (t === 'image/png') return 'png'
  if (t === 'image/webp') return 'webp'
  const part = file.name.split('.').pop()
  const e = part ? part.toLowerCase() : ''
  if (e === 'jpeg' || e === 'jpg') return 'jpg'
  if (e === 'png') return 'png'
  if (e === 'webp') return 'webp'
  return 'jpg'
}

function asRecord(v: unknown) {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

/** URL absoluta ou caminho interno; vazio → null. */
export function normalizeAnuncioLinkUrl(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  if (t.startsWith('/')) return t
  if (/^https?:\/\//i.test(t)) return t
  return `https://${t}`
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
          .select('id')
          .eq('empresa_id', empresaId)
          .eq('tipo', 'home')
          .eq('status', 'ativo')
          .lte('periodo_inicio', isoDate(new Date()))
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

      const anunciosHomeAtivos = (homeRes.data ?? []).length

      setAnuncios(anunciosFmt)
      setReservas(reservasFmt)
      /** Uma única vaga na Home por empresa. */
      setVagasDisponiveis([{ vaga: 'vaga_1', disponivel: anunciosHomeAtivos === 0 }])
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

  /** Upload + insert em `anuncios` (home ativo) — criativo visível no Guia após migração RLS/storage. */
  const publicarAnuncioHome = useCallback(
    async (vaga: string, periodo: PeriodoReserva, file: File, linkDestino: string) => {
      if (!empresaId) throw new Error('Empresa não identificada')
      const mime = (file.type || '').toLowerCase()
      if (!MIME_ANUNCIO_HOME.has(mime)) {
        throw new Error('Use imagem JPG, PNG ou WEBP.')
      }

      const ext = extensaoArquivoImagem(file)
      const objectPath = `${empresaId}/${crypto.randomUUID()}.${ext}`

      const { error: upErr } = await supabase.storage.from('anuncios').upload(objectPath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: mime || undefined,
      })
      if (upErr) throw upErr

      const { data: pub } = supabase.storage.from('anuncios').getPublicUrl(objectPath)
      const imagemUrl = pub?.publicUrl ?? ''
      if (!imagemUrl) throw new Error('URL da imagem indisponível.')

      const duracaoDias = periodo === '7d' ? 7 : periodo === '15d' ? 15 : 30
      const inicio = new Date()
      const fim = new Date()
      fim.setDate(fim.getDate() + duracaoDias)

      const linkNorm = normalizeAnuncioLinkUrl(linkDestino)

      const { error: insErr } = await supabase.from('anuncios').insert({
        empresa_id: empresaId,
        tipo: 'home',
        localizacao: vaga,
        imagem_url: imagemUrl,
        link_url: linkNorm,
        periodo_inicio: isoDate(inicio),
        periodo_fim: isoDate(fim),
        status: 'ativo',
      })
      if (insErr) throw insErr

      await fetchDados()
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
    () => ({
      anuncios,
      reservas,
      vagasDisponiveis,
      loading,
      error,
      reservarVaga,
      publicarAnuncioHome,
      cancelarReserva,
      refetch: fetchDados,
    }),
    [anuncios, reservas, vagasDisponiveis, loading, error, reservarVaga, publicarAnuncioHome, cancelarReserva, fetchDados]
  )
}

