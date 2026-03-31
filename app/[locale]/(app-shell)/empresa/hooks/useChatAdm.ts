'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { MensagemChatAdm } from '../types/empresa.types'

function asRecord(v: unknown) {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

export function useChatAdm(empresaId: string | null) {
  const [mensagens, setMensagens] = useState<MensagemChatAdm[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const carregar = useCallback(async () => {
    if (!empresaId) {
      setMensagens([])
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const { data, error: e } = await supabase
        .from('mensagens_chat_adm')
        .select('id, admin_id, mensagem, lida_empresa, created_at, admin:admin_id(email)')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: true })
        .limit(200)
      if (e) throw e

      const msgs: MensagemChatAdm[] = (data ?? []).map((row) => {
        const r = asRecord(row) ?? {}
        const admin = asRecord(r.admin)
        return {
          id: String(r.id ?? ''),
          admin_id: r.admin_id != null ? String(r.admin_id) : null,
          admin_email: admin?.email != null ? String(admin.email) : null,
          mensagem: String(r.mensagem ?? ''),
          lida_empresa: Boolean(r.lida_empresa),
          created_at: String(r.created_at ?? ''),
        }
      })
      setMensagens(msgs)

      const naoLidas = msgs.filter((m) => !m.lida_empresa).map((m) => m.id)
      if (naoLidas.length) {
        await supabase.from('mensagens_chat_adm').update({ lida_empresa: true }).in('id', naoLidas)
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro ao carregar chat'))
    } finally {
      setLoading(false)
    }
  }, [empresaId])

  const enviar = useCallback(
    async (texto: string) => {
      const msg = texto.trim()
      if (!empresaId || !msg) return
      const { error: e } = await supabase.from('mensagens_chat_adm').insert({
        empresa_id: empresaId,
        mensagem: msg,
        lida_admin: false,
      })
      if (e) throw e
      await carregar()
    },
    [carregar, empresaId]
  )

  useEffect(() => {
    void carregar()
  }, [carregar])

  useEffect(() => {
    if (!empresaId) return
    const ch = supabase
      .channel(`chat-adm-${empresaId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagens_chat_adm', filter: `empresa_id=eq.${empresaId}` }, () => {
        void carregar()
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(ch)
    }
  }, [carregar, empresaId])

  return useMemo(() => ({ mensagens, loading, error, enviar, refetch: carregar }), [mensagens, loading, error, enviar, carregar])
}

