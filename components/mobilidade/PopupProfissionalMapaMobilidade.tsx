'use client'

import { useEffect, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import PopupCartaoVisitaProfissional from '@/components/perfil/PopupCartaoVisitaProfissional'
import { resolverHrefContratarCartaoVisita } from '@/lib/recomendacaoContratacaoDestino'
import { seedProfissionalDrawerSnap, carregarProfissionalDrawerParticular } from '@/lib/profissionalDrawerParticular'
import type { ProfissionalOnlineMapa } from '@/lib/mobilidadeStatusProfissional'
import type { VisitanteParceriaMapa } from '@/lib/mobilidadeMapaVisitante'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import { supabase } from '@/lib/supabase'
import { normalizarCategoriasProfissional } from '@/lib/cartaoVisitaProfissional'
import { turistaPodeAvaliarProfissionalCartao } from '@/lib/cartaoVisitaAvaliacaoTurista'
import { carregarUrlApiMobilidadeParceiro } from '@/lib/appParceiroLink'
import { labelModalidadeMobilidade } from '@/lib/mobilidadePopupPesquisa'

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
  const [turistaPodeAvaliarProf, setTuristaPodeAvaliarProf] = useState(false)

  useEffect(() => {
    let ativo = true
    void supabase.auth.getSession().then(({ data }) => {
      if (ativo) setMeuId(data.session?.user?.id ?? null)
    })
    return () => {
      ativo = false
    }
  }, [])

  useEffect(() => {
    let ativo = true
    if (!meuId || !prof?.usuario_id || meuId === prof.usuario_id) {
      setTuristaPodeAvaliarProf(false)
      return () => {
        ativo = false
      }
    }
    if (userRole !== 'turista' && userRole !== 'admin' && userRole !== 'empresa') {
      setTuristaPodeAvaliarProf(false)
      return () => {
        ativo = false
      }
    }

    void (async () => {
      const ok = await turistaPodeAvaliarProfissionalCartao(
        supabase,
        meuId,
        prof.usuario_id,
        prof.placa_vermelha,
        prof.categorias,
      )
      if (ativo) setTuristaPodeAvaliarProf(ok)
    })()

    return () => {
      ativo = false
    }
  }, [meuId, prof?.usuario_id, prof?.placa_vermelha, prof?.categorias, userRole])

  if (!prof) return null

  const handleContratar = async () => {
    let apiMobilidadeUrl: string | null = null
    const cats = normalizarCategoriasProfissional(prof.categorias)
    if (cats.includes('motorista_app')) {
      apiMobilidadeUrl = await carregarUrlApiMobilidadeParceiro({
        cidadesAtuacao: prof.cidades_atuacao,
      })
    }

    const { href, externo } = resolverHrefContratarCartaoVisita({
      categorias: prof.categorias,
      placaVermelha: prof.placa_vermelha,
      profissionalUsuarioId: prof.usuario_id,
      apiMobilidadeUrl,
    })
    seedProfissionalDrawerSnap(prof.usuario_id, {
      nome_completo: prof.nome_completo || 'Profissional',
      nome_usuario: prof.nome_usuario ?? null,
      foto_url: prof.foto_url,
      verificado: true,
      verificado_em: null,
      categoria_label: labelModalidadeMobilidade(prof.categorias, prof.placa_vermelha),
    })
    void carregarProfissionalDrawerParticular(supabase, prof.usuario_id)
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
      turistaPodeAvaliarProfissional={turistaPodeAvaliarProf}
    />
  )
}
