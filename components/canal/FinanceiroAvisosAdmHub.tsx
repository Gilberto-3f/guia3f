'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarClock, CreditCard, ExternalLink, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { notificarBadgeCanais, notificarBadgeCanaisAposLeitura } from '@/lib/canais-badge-events'
import { adminPodeVerAvisosFinanceiroHub } from '@/lib/financeiroAvisosAdmHub'
import AvatarImage from '@/components/AvatarImage'

type AvisoHubMetadata = {
  empresa_nome_social?: string
  empresa_username?: string
  empresa_foto_url?: string | null
}

type AvisoHub = {
  id: string
  tipo: string
  titulo: string
  mensagem: string
  created_at: string
  lido: boolean
  metadata?: AvisoHubMetadata
}

function usernameExibicao(raw: string | undefined): string {
  const u = String(raw ?? '').trim().replace(/^@+/, '')
  return u ? `@${u}` : '@empresa'
}

/**
 * Cards informativos no topo do Canal Financeiro ADM (ADM GERAL + ADM Financeiro).
 */
export default function FinanceiroAvisosAdmHub() {
  const [avisos, setAvisos] = useState<AvisoHub[]>([])
  const [loading, setLoading] = useState(true)
  const [marcandoId, setMarcandoId] = useState<string | null>(null)
  const [podeVer, setPodeVer] = useState<boolean | null>(null)

  const carregar = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const uid = session?.user?.id
      if (!uid) {
        setPodeVer(false)
        setAvisos([])
        return
      }

      const { data: adminRow } = await supabase
        .from('usuarios')
        .select('admin_level, admin_permissoes')
        .eq('id', uid)
        .maybeSingle()

      if (!adminPodeVerAvisosFinanceiroHub(adminRow)) {
        setPodeVer(false)
        setAvisos([])
        return
      }
      setPodeVer(true)

      const res = await fetch('/api/admin/financeiro-avisos-hub', { credentials: 'include' })
      const json = (await res.json()) as {
        ok?: boolean
        avisos?: Array<AvisoHub & { metadata?: Record<string, unknown> }>
      }
      if (json.ok && Array.isArray(json.avisos)) {
        let mapped = json.avisos.map((a) => ({
          id: a.id,
          tipo: a.tipo,
          titulo: a.titulo,
          mensagem: a.mensagem,
          created_at: a.created_at,
          lido: a.lido,
          metadata: a.metadata as AvisoHubMetadata | undefined,
        }))

        if (mapped.some((a) => !a.lido)) {
          const markRes = await fetch('/api/admin/financeiro-avisos-hub', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ marcar_todos: true }),
          })
          if (markRes.ok) {
            mapped = mapped.map((a) => ({ ...a, lido: true }))
            notificarBadgeCanaisAposLeitura()
          }
        }

        setAvisos(mapped)
      } else {
        setAvisos([])
      }
    } catch {
      setAvisos([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  useEffect(() => {
    if (podeVer !== true) return

    const ch = supabase
      .channel('financeiro-avisos-adm-hub')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'financeiro_avisos_adm_hub' },
        () => {
          void carregar()
          notificarBadgeCanaisAposLeitura()
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'financeiro_avisos_adm_hub' },
        () => {
          void carregar()
          notificarBadgeCanaisAposLeitura()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(ch)
    }
  }, [carregar, podeVer])

  const marcarLido = async (id: string) => {
    setMarcandoId(id)
    try {
      const res = await fetch('/api/admin/financeiro-avisos-hub', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        setAvisos((prev) => prev.map((a) => (a.id === id ? { ...a, lido: true } : a)))
        notificarBadgeCanaisAposLeitura()
      }
    } finally {
      setMarcandoId(null)
    }
  }

  if (podeVer === false) return null

  if (loading) {
    return (
      <div className="mb-4 flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-3 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Carregando avisos…
      </div>
    )
  }

  if (avisos.length === 0) return null

  return (
    <div className="mb-4 mt-3 space-y-3">
      {avisos.map((aviso) => {
        const meta = aviso.metadata ?? {}
        const nomeSocial = String(meta.empresa_nome_social ?? '').trim() || 'Empresa'
        const username = usernameExibicao(meta.empresa_username)
        const foto = meta.empresa_foto_url ?? null
        const ehAgendamento = aviso.tipo === 'agendamento_assinatura_dinheiro'
        const Icon = ehAgendamento ? CalendarClock : CreditCard

        return (
          <div
            key={aviso.id}
            className={`rounded-xl border bg-white p-4 shadow-sm ${
              !aviso.lido ? 'border-l-4 border-[#00D443]' : 'border-gray-200'
            }`}
          >
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0097b2]/10">
                <Icon className="h-5 w-5 text-[#0097b2]" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-gray-900">{aviso.titulo}</h3>
                  {!aviso.lido ? (
                    <span className="rounded-full bg-[#00D443] px-2 py-0.5 text-xs text-white">Nova</span>
                  ) : null}
                </div>

                <div className="mb-3 flex items-center gap-2">
                  <AvatarImage
                    src={foto}
                    alt={nomeSocial}
                    width={36}
                    height={36}
                    className="h-9 w-9 shrink-0 rounded-full object-cover"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">{nomeSocial}</p>
                    <p className="truncate text-xs text-gray-500">{username}</p>
                  </div>
                </div>

                <p className="text-sm leading-relaxed text-gray-700">{aviso.mensagem}</p>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Link
                    href="/dashboard/admin?tab=espaco-adm&sub=financeiro"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#0097b2] hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    ESPAÇO ADM · Gestão de Assinaturas
                  </Link>
                  {!aviso.lido ? (
                    <button
                      type="button"
                      disabled={marcandoId === aviso.id}
                      onClick={() => void marcarLido(aviso.id)}
                      className="text-xs font-semibold text-gray-500 hover:text-gray-800 disabled:opacity-50"
                    >
                      {marcandoId === aviso.id ? 'Marcando…' : 'Marcar como lida'}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
