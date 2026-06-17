'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { useDashboardEmpresa } from '@/app/[locale]/(app-shell)/dashboard/empresa/hooks/useDashboardEmpresa'
import { useEmpresaMenuGate } from '@/app/[locale]/(app-shell)/empresa/hooks/useEmpresaMenuGate'
import { useEmpresaServicosPlano } from '@/hooks/useEmpresaServicosPlano'
import type { FeatureEmpresaId } from '@/lib/planosEmpresaServicosGate'
import { featureEmpresaLiberada } from '@/lib/planosEmpresaServicosGate'
import AvisoPlanoEmpresaBloqueado from '@/components/empresa/AvisoPlanoEmpresaBloqueado'

export default function EmpresaPaginaServicoGate({
  servico,
  children,
  skeleton,
}: {
  servico: FeatureEmpresaId
  children: ReactNode
  skeleton?: ReactNode
}) {
  const gate = useEmpresaMenuGate()
  const { dados } = useDashboardEmpresa()
  const { servicos, loading: loadingPlano } = useEmpresaServicosPlano(dados?.plano, dados?.id)

  const loading = gate === 'loading' || loadingPlano
  const liberado = featureEmpresaLiberada(servico, servicos)

  if (loading) {
    return (
      skeleton ?? (
        <div className="space-y-4 pt-4" aria-busy="true" aria-label="A carregar">
          <div className="h-11 animate-pulse rounded-lg bg-gray-200" />
          <div className="h-36 animate-pulse rounded-lg bg-gray-200 sm:h-52" />
        </div>
      )
    )
  }

  if (gate === 'forbidden') {
    return <div className="py-10 text-center text-sm text-gray-500">A redirecionar…</div>
  }

  if (gate === 'pending') {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
        <p className="text-sm text-amber-900">
          Este recurso fica disponível após a aprovação do cadastro pelo administrador.
        </p>
        <Link
          href="/guia"
          className="mt-4 inline-block rounded-full bg-[#0097b2] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-95"
        >
          Ir para o guia
        </Link>
      </div>
    )
  }

  if (!liberado) {
    return <AvisoPlanoEmpresaBloqueado />
  }

  return <>{children}</>
}
