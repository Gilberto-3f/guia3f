'use client'

import { useCallback, useEffect, useState } from 'react'
import { MapPin, MessageSquare, Navigation, X } from 'lucide-react'
import { useRouter } from '@/i18n/navigation'
import { supabase } from '@/lib/supabase'

type AlertaPerdido = {
  id: string
  membro: { nome: string; username: string }
  loc_lat: number | null
  loc_lng: number | null
}

/**
 * Popup azul (#0097b2) para ADMs quando turista envia mensagem em "Estou perdido(a)".
 */
export default function EcossistemaAlertaPerdido() {
  const router = useRouter()
  const [alertas, setAlertas] = useState<AlertaPerdido[]>([])
  const [visivel, setVisivel] = useState(false)

  const carregar = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/ecossistema-alertas-perdido')
      if (res.status === 401 || res.status === 403) return
      const json = (await res.json()) as { ok?: boolean; alertas?: AlertaPerdido[] }
      if (json.ok && json.alertas && json.alertas.length > 0) {
        setAlertas(
          json.alertas.map((a) => ({
            ...a,
            loc_lat: a.loc_lat != null ? Number(a.loc_lat) : null,
            loc_lng: a.loc_lng != null ? Number(a.loc_lng) : null,
          })),
        )
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

    let debounceId: ReturnType<typeof setTimeout> | null = null
    const agendarCarregar = () => {
      if (debounceId) clearTimeout(debounceId)
      debounceId = setTimeout(() => {
        debounceId = null
        void carregar()
      }, 400)
    }

    const ch = supabase
      .channel('eco-alertas-perdido-adm')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'ecossistema_conversas' },
        (payload) => {
          const row = payload.new as Record<string, unknown> | undefined
          if (!row) return
          const motivo = String(row.motivo_emergencia ?? '')
          const urgente = row.urgente === true
          const visto = row.alerta_urgente_visto === true
          const aberta = String(row.status ?? '') === 'aberta'
          const turista = String(row.membro_tipo ?? '') === 'turista'
          if (motivo === 'perdido' && urgente && !visto && aberta && turista) {
            agendarCarregar()
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ecossistema_mensagens' },
        () => {
          agendarCarregar()
        },
      )
      .subscribe()

    return () => {
      if (debounceId) clearTimeout(debounceId)
      void supabase.removeChannel(ch)
    }
  }, [carregar])

  const dispensar = async (conversaId: string, abrirCanal: boolean) => {
    await fetch('/api/admin/ecossistema-alertas-perdido', {
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
  const temLoc =
    atual.loc_lat != null &&
    atual.loc_lng != null &&
    Number.isFinite(atual.loc_lat) &&
    Number.isFinite(atual.loc_lng)
  const mapsUrl = temLoc
    ? `https://www.google.com/maps?q=${atual.loc_lat},${atual.loc_lng}`
    : null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
      <div
        role="alertdialog"
        aria-labelledby="alerta-perdido-titulo"
        className="w-full max-w-md overflow-hidden rounded-2xl border-2 border-[#0097b2]/40 bg-[#0097b2] shadow-2xl"
      >
        <div className="flex items-start gap-3 px-5 pt-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15">
            <Navigation className="h-7 w-7 text-white" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 text-white">
            <h2 id="alerta-perdido-titulo" className="text-lg font-bold uppercase tracking-wide">
              ATENÇÃO
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-white/95">
              O mensageiro recebeu uma mensagem de um turista que está perdido:{' '}
              <strong className="font-bold">{username}</strong>.
            </p>
            <p className="mt-1 text-xs text-white/80">{atual.membro.nome}</p>
            {temLoc ? (
              <p className="mt-2 flex items-center gap-1 text-xs text-white/90">
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Localização em tempo real disponível no canal.
              </p>
            ) : null}
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

        <div className="mt-4 flex items-center gap-2 border-t border-white/20 bg-[#007d94]/50 px-5 py-3">
          <Navigation className="h-5 w-5 shrink-0 text-white" aria-hidden />
          <MessageSquare className="h-5 w-5 shrink-0 text-white" aria-hidden />
          <span className="text-xs font-semibold uppercase tracking-wide text-white/90">
            Estou perdido(a) — Mensageiro ECOSSISTEMA
          </span>
        </div>

        <div className="flex flex-col gap-2 px-5 pb-5 pt-4">
          {mapsUrl ? (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/15 py-3 text-sm font-bold uppercase tracking-wide text-white hover:bg-white/25"
            >
              <MapPin className="h-4 w-4" aria-hidden />
              Ver localização no mapa
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => void dispensar(atual.id, true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-bold uppercase tracking-wide text-[#0097b2] hover:bg-blue-50"
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
