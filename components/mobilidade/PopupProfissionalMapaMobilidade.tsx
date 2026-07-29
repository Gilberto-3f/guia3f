'use client'

import { useEffect, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import PopupCartaoVisitaProfissional from '@/components/perfil/PopupCartaoVisitaProfissional'
import {
  hrefDestinoContratacao,
  resolverDestinoContratacaoRecomendacao,
} from '@/lib/recomendacaoContratacaoDestino'
import type { ProfissionalOnlineMapa } from '@/lib/mobilidadeStatusProfissional'
import type { VisitanteParceriaMapa } from '@/lib/mobilidadeMapaVisitante'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import { supabase } from '@/lib/supabase'

type Props = {
  prof: ProfissionalOnlineMapa | null
  onFechar: () => void
  visitanteParceria: VisitanteParceriaMapa | null
}

export default function PopupProfissionalMapaMobilidade({
  prof,
  onFechar,
  visitanteParceria,
}: Props) {
  const router = useRouter()
  const { userRole } = useProfissionalGate()
  const [meuId, setMeuId] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    void supabase.auth.getSession().then(({ data }) => {
      if (ativo) setMeuId(data.session?.user?.id ?? null)
    })
    return () => {
      ativo = false
    }
  }, [])

  if (!prof) return null

  const handleContratar = () => {
    const destino = resolverDestinoContratacaoRecomendacao({
      categoriasIndicado: prof.categorias,
      placaVermelhaIndicado: prof.placa_vermelha,
      profissionalUsuarioId: prof.usuario_id,
    })
    const href = hrefDestinoContratacao(destino)
    if (href) router.push(href)
    onFechar()
  }

  const cidadeVisitado =
    prof.cidades_atuacao?.[0] ??
    (prof.cidades_atuacao?.length ? prof.cidades_atuacao[0] : null)

  return (
    <PopupCartaoVisitaProfissional
      aberto
      onFechar={onFechar}
      profileId={prof.usuario_id}
      profissionalIndicadoId={prof.id}
      nome={prof.nome_completo}
      username={prof.nome_usuario ?? ''}
      avatarUrl={prof.foto_url}
      categorias={prof.categorias}
      placaVermelha={prof.placa_vermelha}
      profissionalVerificado
      meuId={meuId}
      meuRole={userRole}
      visitantePlacaVermelha={visitanteParceria?.placaVermelha ?? false}
      visitanteCategorias={visitanteParceria?.categorias ?? []}
      cidadeAtuacaoVisitado={cidadeVisitado}
      onContratar={handleContratar}
    />
  )
}
