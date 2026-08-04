'use client'

import { useCallback, useEffect, useState } from 'react'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import PopupChegadaTuristaMobilidade from '@/components/mobilidade/PopupChegadaTuristaMobilidade'

type CorridaTurista = {
  solicitacao_id: string
  status: string
  profissional_username: string | null
  profissional_whatsapp: string | null
}

/**
 * Mostra "Profissional CHEGOU!!!" mesmo se o popup de resultado da corrida foi fechado.
 */
export default function ChegadaTuristaMobilidadeListener() {
  const { perfilEhTurista, perfilEhEmpresa, perfilEhProfissional, roleEfetivo, loading } =
    useProfissionalGate()
  const [corrida, setCorrida] = useState<CorridaTurista | null>(null)
  const [dismissedId, setDismissedId] = useState<string | null>(null)

  const elegivel =
    !loading &&
    !perfilEhProfissional &&
    (perfilEhTurista || perfilEhEmpresa || roleEfetivo === 'admin')

  const carregar = useCallback(async () => {
    if (!elegivel) return
    try {
      const res = await fetch('/api/mobilidade/corrida-ativa-turista')
      if (!res.ok) return
      const json = (await res.json()) as { corrida?: CorridaTurista | null }
      setCorrida(json.corrida ?? null)
    } catch {
      /* ignore */
    }
  }, [elegivel])

  useEffect(() => {
    if (!elegivel) return
    let ativo = true
    const boot = window.setTimeout(() => {
      if (!ativo) return
      void carregar()
    }, 2000)
    const id = setInterval(() => void carregar(), 8_000)
    return () => {
      ativo = false
      window.clearTimeout(boot)
      clearInterval(id)
    }
  }, [elegivel, carregar])

  if (!elegivel || !corrida) return null
  if (String(corrida.status) !== 'no_local') return null
  if (dismissedId === corrida.solicitacao_id) return null

  return (
    <PopupChegadaTuristaMobilidade
      aberto
      usernameProfissional={corrida.profissional_username}
      whatsappProfissional={corrida.profissional_whatsapp}
      onFechar={() => setDismissedId(corrida.solicitacao_id)}
    />
  )
}
