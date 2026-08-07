'use client'

import { useEffect, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import PopupCartaoVisitaProfissional from '@/components/perfil/PopupCartaoVisitaProfissional'
import { resolverHrefContratarCartaoVisita } from '@/lib/recomendacaoContratacaoDestino'
import type { ProfissionalOnlineMapa } from '@/lib/mobilidadeStatusProfissional'
import type { VisitanteParceriaMapa } from '@/lib/mobilidadeMapaVisitante'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import { supabase } from '@/lib/supabase'
import { normalizarCategoriasProfissional } from '@/lib/cartaoVisitaProfissional'
import {
  canalParceiroPorCidadesAtuacao,
  CONFIG_APIS_MOBILIDADE_SELECT,
  resolverUrlApiMobilidadeParceiro,
} from '@/lib/mobilidadeParceiroApi'

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

  const handleContratar = async () => {
    let apiMobilidadeUrl: string | null = null
    const cats = normalizarCategoriasProfissional(prof.categorias)
    if (cats.includes('motorista_app')) {
      const { data: cfg } = await supabase
        .from('config_apis')
        .select(CONFIG_APIS_MOBILIDADE_SELECT)
        .limit(1)
        .maybeSingle()
      const canal = canalParceiroPorCidadesAtuacao(prof.cidades_atuacao)
      apiMobilidadeUrl = resolverUrlApiMobilidadeParceiro(cfg, canal)
    }

    const { href, externo } = resolverHrefContratarCartaoVisita({
      categorias: prof.categorias,
      placaVermelha: prof.placa_vermelha,
      profissionalUsuarioId: prof.usuario_id,
      apiMobilidadeUrl,
    })
    onFechar()
    if (!href) return
    if (externo) {
      window.location.assign(href)
      return
    }
    router.push(href)
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
      verificadoEm={null}
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
