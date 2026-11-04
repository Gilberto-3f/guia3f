'use client'

import { useCallback, useEffect, useState } from 'react'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'
import PopupConviteAdmin from '@/components/PopupConviteAdmin'

const CACHE_KEY = 'guia_convite_admin_v1'
const CACHE_MS = 15 * 60 * 1000
const FETCH_MS = 3_000

function lerCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const o = JSON.parse(raw)
    if (!o || typeof o.at !== 'number') return null
    if (Date.now() - o.at > CACHE_MS) return null
    return o
  } catch {
    return null
  }
}

function gravarCache(convite) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), convite: convite ?? null }))
  } catch {
    /* ignore */
  }
}

/** Popup branco de convite administrativo pendente. */
export default function ConviteAdminGate() {
  const { modoAtivo } = useModoApresentacao()
  const [convite, setConvite] = useState(null)
  const [loading, setLoading] = useState(false)

  const carregar = useCallback(async () => {
    if (modoAtivo) return
    const cached = lerCache()
    if (cached) {
      setConvite(cached.convite ?? null)
      return
    }
    const ac = new AbortController()
    const t = window.setTimeout(() => ac.abort(), FETCH_MS)
    try {
      const res = await fetch('/api/admin/convites/pendente', {
        credentials: 'include',
        signal: ac.signal,
      })
      const json = await res.json().catch(() => ({}))
      const next = json.convite ?? null
      setConvite(next)
      gravarCache(next)
    } catch {
      setConvite(null)
      gravarCache(null)
    } finally {
      window.clearTimeout(t)
    }
  }, [modoAtivo])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const responder = async (acao) => {
    if (!convite?.id) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/convites/responder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ convite_id: convite.id, acao }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) {
        alert(json.error ?? 'Não foi possível responder ao convite.')
        return
      }
      setConvite(null)
      gravarCache(null)
      window.dispatchEvent(new CustomEvent('admin-convite-respondido'))
    } finally {
      setLoading(false)
    }
  }

  if (modoAtivo || !convite) return null

  return (
    <PopupConviteAdmin
      isOpen
      funcao={convite.funcao ?? 'Administrador'}
      comunidade={convite.comunidade ?? ''}
      pais={convite.pais ?? ''}
      ecossistema={convite.ecossistema ?? ''}
      convidadoPor={convite.convidado_por ?? 'ADM GERAL'}
      loading={loading}
      onAceitar={() => responder('aceitar')}
      onRecusar={() => responder('recusar')}
    />
  )
}
