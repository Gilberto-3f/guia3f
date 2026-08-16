'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import CriarStory from '@/components/CriarStory'
import { supabase } from '@/lib/supabase'
import { useAnfitriaoModo } from '@/context/AnfitriaoModoContext'
import { useGuiaModo } from '@/context/GuiaModoContext'
import { useVanModo } from '@/context/VanModoContext'
import {
  profissionalOperaComoEmpresaEmAlgumDualMode,
  resolverStoryAutorTipoPublicacao,
} from '@/lib/storyAutorTipoPublicacao'

function CriarStoryPageInner() {
  const searchParams = useSearchParams()
  const agendarCardKey = searchParams.get('agendar')
  const [autorTipo, setAutorTipo] = useState('turista')
  const { ehAnfitriao, modo, empresaHospedagemId, empresaHospedagemLiberada } = useAnfitriaoModo()
  const {
    ehGuia,
    modoEfetivo: modoGuiaEfetivo,
    empresaAgenciaId,
    empresaAgenciaLiberada,
  } = useGuiaModo()
  const {
    ehVan,
    modoEfetivo: modoVanEfetivo,
    empresaAgenciaVanId,
    empresaAgenciaVanLiberada,
  } = useVanModo()

  useEffect(() => {
    const run = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.user?.id) return
      const { data } = await supabase.from('usuarios').select('role').eq('id', session.user.id).maybeSingle()
      const r = data?.role != null ? String(data.role) : 'turista'
      const comoEmpresa = profissionalOperaComoEmpresaEmAlgumDualMode({
        role: r,
        ehAnfitriao,
        modoAnfitriao: modo,
        empresaHospedagemId,
        empresaHospedagemLiberada,
        ehGuia,
        modoGuia: modoGuiaEfetivo,
        empresaAgenciaId,
        empresaAgenciaLiberada,
        ehVan,
        modoVan: modoVanEfetivo,
        empresaAgenciaVanId,
        empresaAgenciaVanLiberada,
      })
      setAutorTipo(resolverStoryAutorTipoPublicacao(r, comoEmpresa))
    }
    void run()
  }, [
    ehAnfitriao,
    modo,
    empresaHospedagemId,
    empresaHospedagemLiberada,
    ehGuia,
    modoGuiaEfetivo,
    empresaAgenciaId,
    empresaAgenciaLiberada,
    ehVan,
    modoVanEfetivo,
    empresaAgenciaVanId,
    empresaAgenciaVanLiberada,
  ])

  return <CriarStory autorTipo={autorTipo} agendarCardKey={agendarCardKey} />
}

export default function CriarStoryPage() {
  return (
    <Suspense fallback={null}>
      <CriarStoryPageInner />
    </Suspense>
  )
}
