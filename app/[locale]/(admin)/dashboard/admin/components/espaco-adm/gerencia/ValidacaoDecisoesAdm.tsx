'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useGerenciaAdm } from '../../../hooks/useGerenciaAdm'
import { useInfracoes } from '../../../hooks/useInfracoes'

type BanimentoPendente = {
  id: string
  usuario_id: string
  denuncia_id: string | null
  motivo: string | null
  created_at: string
  solicitado_por: string | null
  solicitado_nome: string
  usuario_nome: string
}

export function ValidacaoDecisoesAdm() {
  const { isAdminGeral } = useGerenciaAdm()
  const { confirmarBanimento } = useInfracoes()
  const [lista, setLista] = useState<BanimentoPendente[]>([])
  const [loading, setLoading] = useState(true)
  const [processando, setProcessando] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    if (!isAdminGeral) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('banimentos_confirmacao')
        .select('id, usuario_id, denuncia_id, motivo, created_at, solicitado_por')
        .eq('status', 'pendente')
        .order('created_at', { ascending: false })

      if (error) throw error

      const rows = data ?? []
      const userIds = [
        ...new Set(
          rows.flatMap((r) => [r.usuario_id, r.solicitado_por].filter(Boolean)).map(String),
        ),
      ]

      const nomes = new Map<string, string>()
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from('usuarios')
          .select('id, username, email, nome_completo')
          .in('id', userIds)
        for (const u of users ?? []) {
          nomes.set(
            String(u.id),
            String(u.nome_completo ?? u.username ?? u.email ?? u.id).trim(),
          )
        }
      }

      setLista(
        rows.map((r) => ({
          id: String(r.id),
          usuario_id: String(r.usuario_id),
          denuncia_id: r.denuncia_id != null ? String(r.denuncia_id) : null,
          motivo: r.motivo != null ? String(r.motivo) : null,
          created_at: String(r.created_at ?? ''),
          solicitado_por: r.solicitado_por != null ? String(r.solicitado_por) : null,
          solicitado_nome:
            r.solicitado_por != null ? nomes.get(String(r.solicitado_por)) ?? 'ADM' : 'ADM',
          usuario_nome: nomes.get(String(r.usuario_id)) ?? String(r.usuario_id).slice(0, 8),
        })),
      )
    } catch {
      setLista([])
    } finally {
      setLoading(false)
    }
  }, [isAdminGeral])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const recusar = async (id: string) => {
    setProcessando(id)
    try {
      const { error } = await supabase
        .from('banimentos_confirmacao')
        .update({ status: 'recusado' })
        .eq('id', id)
      if (error) throw error
      await carregar()
    } finally {
      setProcessando(null)
    }
  }

  const confirmar = async (id: string) => {
    setProcessando(id)
    try {
      await confirmarBanimento(id)
      await carregar()
    } finally {
      setProcessando(null)
    }
  }

  if (!isAdminGeral) return null

  if (loading) {
    return <p className="text-xs text-gray-500">Carregando decisões pendentes…</p>
  }

  if (lista.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-6 text-center text-xs text-gray-500">
        Nenhuma decisão aguardando validação do ADM GERAL.
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {lista.map((item) => (
        <li key={item.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs">
          <p className="font-semibold text-gray-900">
            Banimento solicitado — {item.usuario_nome}
          </p>
          <p className="mt-1 text-gray-600">
            Solicitado por <strong>{item.solicitado_nome}</strong>
            {item.motivo ? <> · {item.motivo}</> : null}
          </p>
          <p className="mt-1 text-[11px] text-gray-400">
            {new Date(item.created_at).toLocaleString('pt-BR')}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={processando === item.id}
              onClick={() => {
                void confirmar(item.id)
              }}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white disabled:opacity-50"
            >
              Validar decisão
            </button>
            <button
              type="button"
              disabled={processando === item.id}
              onClick={() => {
                void recusar(item.id)
              }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 font-semibold text-gray-700 disabled:opacity-50"
            >
              Recusar
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
