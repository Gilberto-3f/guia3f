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

/** Mensagem ao tentar criar segundo anúncio home em veiculação. */
export const MSG_ANUNCIO_HOME_LIMITE_ATIVO =
  'Você já possui um anúncio ativo. Para criar um novo, finalize ou aguarde o término do atual.'

/** Home no ar na Guia (mesmas regras do carrossel público). */
export function anuncioHomeEmVeiculacao(a: Anuncio, hojeIso: string): boolean {
  return (
    a.tipo === 'home' &&
    a.status === 'ativo' &&
    a.periodo_inicio <= hojeIso &&
    a.periodo_fim >= hojeIso
  )
}

/** Campanhas home encerradas ou desativadas (aba Histórico). */
export function anuncioHomeNoHistorico(a: Anuncio, hojeIso: string): boolean {
  return a.tipo === 'home' && (a.status === 'inativo' || a.periodo_fim < hojeIso)
}

export function usePublicidade(empresaId: string | null) {
  const [anuncios, setAnuncios] = useState<Anuncio[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchDados = useCallback(async () => {
    if (!empresaId) {
      /* Evita flash: sem empresa ainda não mostramos o formulário completo. */
      setAnuncios([])
      setError(null)
      setLoading(true)
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

  const desativarAnuncio = useCallback(
    async (anuncioId: string) => {
      if (!empresaId) throw new Error('Empresa não identificada')
      const { data: atualizados, error: upErr } = await supabase
        .from('anuncios')
        .update({ status: 'inativo' })
        .eq('id', anuncioId)
        .eq('empresa_id', empresaId)
        .eq('tipo', 'home')
        .eq('status', 'ativo')
        .select('id')
      if (upErr) throw upErr
      if (!atualizados || atualizados.length === 0) {
        throw new Error('Este anúncio não está ativo ou já foi finalizado.')
      }
      await fetchDados()
    },
    [empresaId, fetchDados]
  )

  /** Upload + insert em `anuncios` (home, ativo, 30 dias). Máx. 1 home em veiculação por empresa. */
  const salvarAnuncioHomeArte = useCallback(
    async (file: File) => {
      if (!empresaId) throw new Error('Empresa não identificada')
      const mime = (file.type || '').toLowerCase()
      if (!MIME_ANUNCIO_HOME.has(mime)) {
        throw new Error('Use imagem JPG, PNG ou WEBP.')
      }

      const hoje = isoDate(new Date())
      const { data: jaAtivos, error: qErr } = await supabase
        .from('anuncios')
        .select('id')
        .eq('empresa_id', empresaId)
        .eq('tipo', 'home')
        .eq('status', 'ativo')
        .lte('periodo_inicio', hoje)
        .gte('periodo_fim', hoje)
        .limit(1)
      if (qErr) throw qErr
      if ((jaAtivos?.length ?? 0) > 0) {
        throw new Error(MSG_ANUNCIO_HOME_LIMITE_ATIVO)
      }

      const ext = extensaoArquivoImagem(file)
      const objectPath = `${empresaId}/${crypto.randomUUID()}.${ext}`

      const { error: uploadError } = await supabase.storage.from('anuncios').upload(objectPath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: mime || undefined,
      })
      if (uploadError) throw uploadError

      const { data: pub } = supabase.storage.from('anuncios').getPublicUrl(objectPath)
      const imagemUrl = pub?.publicUrl ?? ''
      if (!imagemUrl) throw new Error('URL da imagem indisponível.')

      const inicio = new Date()
      const fim = new Date()
      fim.setDate(fim.getDate() + DURACAO_ANUNCIO_HOME_DIAS)

      const { data: insertRow, error: insertError } = await supabase
        .from('anuncios')
        .insert({
          empresa_id: empresaId,
          tipo: 'home',
          localizacao: null,
          imagem_url: imagemUrl,
          link_url: null,
          periodo_inicio: isoDate(inicio),
          periodo_fim: isoDate(fim),
          status: 'ativo',
        })
        .select('id')
        .single()

      if (insertError) throw insertError
      if (!insertRow?.id) throw new Error('Anúncio criado mas ID não retornado.')

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
      desativarAnuncio,
      refetch: fetchDados,
    }),
    [anuncios, loading, error, salvarAnuncioHomeArte, desativarAnuncio, fetchDados]
  )
}
