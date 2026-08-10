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
  semBloqueioServico = false,
}: {
  servico: FeatureEmpresaId
  children: ReactNode
  skeleton?: ReactNode
  /** Página acessível; bloqueio de serviço fica a cargo do conteúdo interno (ex.: Publicidade). */
  semBloqueioServico?: boolean
}) {
  const gate = useEmpresaMenuGate()
  const { dados, loading: empresaLoading } = useDashboardEmpresa()
  const { servicos, loading: loadingPlano } = useEmpresaServicosPlano(dados?.plano, dados?.id, {
    aguardarEmpresa: empresaLoading || dados?.id == null,
    /** Anfitrião e agência de guia: pasta empresa gratuita (sem plano pago). */
    somenteAnfitriao: Boolean(dados?.somente_anfitriao || dados?.somente_guia),
  })

  const aguardandoLiberacao = gate === 'loading' || empresaLoading || loadingPlano || dados?.id == null
  const liberado = featureEmpresaLiberada(servico, servicos)

  if (aguardandoLiberacao) {
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

  if (!semBloqueioServico && !liberado) {
    return <AvisoPlanoEmpresaBloqueado />
  }

  return <>{children}</>
}
