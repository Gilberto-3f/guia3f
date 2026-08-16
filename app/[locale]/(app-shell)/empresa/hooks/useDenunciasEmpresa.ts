'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface DenunciaEmpresa {
  id: string
  motivo: string
  descricao: string
  evidencias: string[]
  status: string
  created_at: string
  denunciante_email: string | null
  denunciante_nome: string | null
}

function asRecord(v: unknown) {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function asStringArray(v: unknown) {
  if (Array.isArray(v)) return v.map((x) => String(x))
  if (typeof v === 'string') {
    try {
      const p = JSON.parse(v)
      if (Array.isArray(p)) return p.map((x) => String(x))
    } catch {
      // ignore
    }
  }
  return [] as string[]
}

export function useDenunciasEmpresa(empresaId: string | null) {
  const [denuncias, setDenuncias] = useState<DenunciaEmpresa[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const carregar = useCallback(async () => {
    if (!empresaId) {
      setDenuncias([])
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      // `usuarios` não tem nome_completo — usar username/email.
      const { data, error: e } = await supabase
        .from('denuncias')
        .select(
          'id, motivo, descricao, evidencias, status, created_at, denunciante:denunciante_id(email, username)',
        )
        .eq('denunciado_id', empresaId)
        .eq('denunciado_tipo', 'empresa')
        .order('created_at', { ascending: false })
        .limit(100)
      if (e) throw e

      const fmt: DenunciaEmpresa[] = (data ?? []).map((row) => {
        const r = asRecord(row) ?? {}
        const den = asRecord(r.denunciante)
        const username =
          den?.username != null ? String(den.username).replace(/^@+/, '').trim() : ''
        const email = den?.email != null ? String(den.email) : null
        return {
          id: String(r.id ?? ''),
          motivo: String(r.motivo ?? ''),
          descricao: String(r.descricao ?? ''),
          evidencias: asStringArray(r.evidencias),
          status: String(r.status ?? 'pendente'),
          created_at: String(r.created_at ?? ''),
          denunciante_email: email,
          denunciante_nome: username || email,
        }
      })
      setDenuncias(fmt)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro ao carregar denúncias'))
    } finally {
      setLoading(false)
    }
  }, [empresaId])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const responderViaChatAdm = useCallback(
    async (denunciaId: string, resposta: string) => {
      if (!empresaId) return
      const msg = resposta.trim()
      if (!msg) return
      const texto = `[DENÚNCIA ${denunciaId}] ${msg}`
      const { error: e } = await supabase.from('mensagens_chat_adm').insert({
        empresa_id: empresaId,
        mensagem: texto,
        lida_admin: false,
      })
      if (e) throw e
    },
    [empresaId]
  )

  return useMemo(() => ({ denuncias, loading, error, responderViaChatAdm, refetch: carregar }), [denuncias, loading, error, responderViaChatAdm, carregar])
}

