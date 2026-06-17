'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, MessageSquare, ShieldAlert, X } from 'lucide-react'
import { useRouter } from '@/i18n/navigation'
import { supabase } from '@/lib/supabase'

type AlertaUrgente = {
  id: string
  membro: { nome: string; username: string }
}

/**
 * Popup global para ADMs quando um turista aciona CHAMAR ADM (socorro).
 */
export default function EcossistemaAlertaUrgente() {
  const router = useRouter()
  const [alertas, setAlertas] = useState<AlertaUrgente[]>([])
  const [visivel, setVisivel] = useState(false)

  const carregar = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/ecossistema-alertas-urgentes')
      if (res.status === 401 || res.status === 403) return
      const json = (await res.json()) as { ok?: boolean; alertas?: AlertaUrgente[] }
      if (json.ok && json.alertas && json.alertas.length > 0) {
        setAlertas(json.alertas)
        setVisivel(true)
      } else {
        setAlertas([])
        setVisivel(false)
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    void carregar()

    const ch = supabase
      .channel('eco-alertas-urgentes-adm')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ecossistema_conversas' },
        (payload) => {
          const row = payload.new as Record<string, unknown> | undefined
          if (!row) return
          const urgente = row.urgente === true
          const visto = row.alerta_urgente_visto === true
          const aberta = String(row.status ?? '') === 'aberta'
          const turista = String(row.membro_tipo ?? '') === 'turista'
          if (urgente && !visto && aberta && turista) {
            void carregar()
          }
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(ch)
    }
  }, [carregar])

  const dispensar = async (conversaId: string, abrirCanal: boolean) => {
    await fetch('/api/admin/ecossistema-alertas-urgentes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversa_id: conversaId }),
    })
    setVisivel(false)
    setAlertas((prev) => prev.filter((a) => a.id !== conversaId))
    if (abrirCanal) router.push('/canal')
  }

  if (!visivel || alertas.length === 0) return null

  const atual = alertas[0]
  const username = atual.membro.username.startsWith('@')
    ? atual.membro.username
    : `@${atual.membro.username}`

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
      <div
        role="alertdialog"
        aria-labelledby="alerta-urgente-titulo"
        className="w-full max-w-md overflow-hidden rounded-2xl border-2 border-red-300 bg-red-600 shadow-2xl"
      >
        <div className="flex items-start gap-3 px-5 pt-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15">
            <ShieldAlert className="h-7 w-7 text-white" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 text-white">
            <h2 id="alerta-urgente-titulo" className="text-lg font-bold uppercase tracking-wide">
              ATENÇÃO
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-white/95">
              usuário <strong className="font-bold">{username}</strong> solicitou ajuda emergencial de um ADM no chat.
            </p>
            <p className="mt-1 text-xs text-white/80">{atual.membro.nome}</p>
          </div>
          <button
            type="button"
            onClick={() => void dispensar(atual.id, false)}
            className="shrink-0 rounded-lg p-1 text-white/80 hover:bg-white/10 hover:text-white"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2 border-t border-white/20 bg-red-700/40 px-5 py-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-white" aria-hidden />
          <MessageSquare className="h-5 w-5 shrink-0 text-white" aria-hidden />
          <span className="text-xs font-semibold uppercase tracking-wide text-white/90">Socorro — Mensageiro ECOSSISTEMA</span>
        </div>

        <div className="flex flex-col gap-2 px-5 pb-5 pt-4">
          <button
            type="button"
            onClick={() => void dispensar(atual.id, true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-bold uppercase tracking-wide text-red-700 hover:bg-red-50"
          >
            <MessageSquare className="h-4 w-4" aria-hidden />
            Abrir Mensageiro ECOSSISTEMA
          </button>
          <button
            type="button"
            onClick={() => void dispensar(atual.id, false)}
            className="w-full rounded-xl border border-white/40 py-3 text-sm font-semibold text-white hover:bg-white/10"
          >
            Dispensar aviso
          </button>
        </div>
      </div>
    </div>
  )
}
