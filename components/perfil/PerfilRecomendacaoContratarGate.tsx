'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import PopupContratarProfissionalRecomendado from '@/components/PopupContratarProfissionalRecomendado'

type ProfPopup = {
  nome: string
  username: string
  foto_url: string | null
  categorias: string
  nota_media: number
  total_avaliacoes: number
}

type Props = {
  profileId: string
  meuId: string | null
  meuRole: string | null
  perfilRole: string | null
}

export default function PerfilRecomendacaoContratarGate({ profileId, meuId, meuRole, perfilRole }: Props) {
  const searchParams = useSearchParams()
  const [aberto, setAberto] = useState(false)
  const [recId, setRecId] = useState('')
  const [indicador, setIndicador] = useState<ProfPopup | null>(null)
  const [indicado, setIndicado] = useState<ProfPopup | null>(null)
  const [jaContratado, setJaContratado] = useState(false)

  useEffect(() => {
    const ref = searchParams.get('ref')
    const rec = searchParams.get('rec')
    if (ref !== 'recomendacao' || !rec || perfilRole !== 'profissional') return
    if (meuRole !== 'turista' || !meuId) return

    let ativo = true
    void (async () => {
      try {
        const res = await fetch(
          `/api/profissional/recomendacao-popup?rec=${encodeURIComponent(rec)}&indicado=${encodeURIComponent(profileId)}`,
        )
        const json = (await res.json()) as {
          ok?: boolean
          recomendacao_id?: string
          ja_contratado?: boolean
          indicador?: ProfPopup
          indicado?: ProfPopup
        }
        if (!ativo || !json.ok || !json.indicador || !json.indicado) return
        setRecId(String(json.recomendacao_id ?? rec))
        setIndicador(json.indicador)
        setIndicado(json.indicado)
        setJaContratado(Boolean(json.ja_contratado))
        setAberto(true)
      } catch {
        /* ignore */
      }
    })()

    return () => {
      ativo = false
    }
  }, [searchParams, profileId, meuId, meuRole, perfilRole])

  return (
    <PopupContratarProfissionalRecomendado
      aberto={aberto}
      onFechar={() => setAberto(false)}
      recomendacaoId={recId}
      profissionalUsuarioId={profileId}
      indicador={indicador}
      indicado={indicado}
      jaContratado={jaContratado}
      onContratado={() => setJaContratado(true)}
    />
  )
}
