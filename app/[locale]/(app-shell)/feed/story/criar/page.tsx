'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import CriarStory from '@/components/CriarStory'
import { supabase } from '@/lib/supabase'
import { useAnfitriaoModo } from '@/context/AnfitriaoModoContext'
import { useGuiaModo } from '@/context/GuiaModoContext'
import { useVanModo } from '@/context/VanModoContext'
import { profissionalOperaComoEmpresaHospedagem } from '@/lib/anfitriaoDualMode'
import { profissionalOperaComoEmpresaAgencia } from '@/lib/guiaDualMode'
import { profissionalOperaComoEmpresaAgenciaVan } from '@/lib/vanDualMode'

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
      const comoEmpresa =
        profissionalOperaComoEmpresaHospedagem(
          r,
          ehAnfitriao,
          modo,
          empresaHospedagemId,
          empresaHospedagemLiberada,
        ) ||
        profissionalOperaComoEmpresaAgencia(
          r,
          ehGuia,
          modoGuiaEfetivo,
          empresaAgenciaId,
          empresaAgenciaLiberada,
        ) ||
        profissionalOperaComoEmpresaAgenciaVan(
          r,
          ehVan,
          modoVanEfetivo,
          empresaAgenciaVanId,
          empresaAgenciaVanLiberada,
        )
      setAutorTipo(comoEmpresa ? 'empresa' : r)
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
