'use client'

import { useCallback, useEffect, useState } from 'react'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'
import PopupConviteAdmin from '@/components/PopupConviteAdmin'

/** Popup branco de convite administrativo pendente. */
export default function ConviteAdminGate() {
  const { modoAtivo } = useModoApresentacao()
  const [convite, setConvite] = useState(null)
  const [loading, setLoading] = useState(false)

  const carregar = useCallback(async () => {
    if (modoAtivo) return
    try {
      const res = await fetch('/api/admin/convites/pendente', { credentials: 'include' })
      const json = await res.json().catch(() => ({}))
      setConvite(json.convite ?? null)
    } catch {
      setConvite(null)
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
      convidadoPor={convite.convidado_por ?? 'ADM GERAL'}
      loading={loading}
      onAceitar={() => responder('aceitar')}
      onRecusar={() => responder('recusar')}
    />
  )
}
