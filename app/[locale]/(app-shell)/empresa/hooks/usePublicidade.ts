'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Anuncio } from '../types/empresa.types'

const MIME_ANUNCIO_HOME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])

/** Vigência fixa ao publicar pela empresa (simplificado). */
const DURACAO_ANUNCIO_HOME_DIAS = 30

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

export function usePublicidade(empresaId: string | null) {
  const [anuncios, setAnuncios] = useState<Anuncio[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchDados = useCallback(async () => {
    if (!empresaId) {
      setLoading(false)
      setAnuncios([])
      return
    }

    setLoading(true)
    setError(null)
    try {
      const { data, error: anErr } = await supabase
        .from('anuncios')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false })

      if (anErr) throw anErr

      const anunciosFmt: Anuncio[] = (data ?? []).map((row) => {
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

      setAnuncios(anunciosFmt)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro ao carregar publicidade'))
    } finally {
      setLoading(false)
    }
  }, [empresaId])

  /** Upload + insert em `anuncios` (home, ativo, 30 dias). */
  const salvarAnuncioHomeArte = useCallback(
    async (file: File) => {
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

      const inicio = new Date()
      const fim = new Date()
      fim.setDate(fim.getDate() + DURACAO_ANUNCIO_HOME_DIAS)

      const { error: insErr } = await supabase.from('anuncios').insert({
        empresa_id: empresaId,
        tipo: 'home',
        localizacao: null,
        imagem_url: imagemUrl,
        link_url: null,
        periodo_inicio: isoDate(inicio),
        periodo_fim: isoDate(fim),
        status: 'ativo',
      })
      if (insErr) throw insErr

      await fetchDados()
    },
    [empresaId, fetchDados]
  )

  useEffect(() => {
    void fetchDados()
  }, [fetchDados])

  return useMemo(
    () => ({
      anuncios,
      loading,
      error,
      salvarAnuncioHomeArte,
      refetch: fetchDados,
    }),
    [anuncios, loading, error, salvarAnuncioHomeArte, fetchDados]
  )
}
