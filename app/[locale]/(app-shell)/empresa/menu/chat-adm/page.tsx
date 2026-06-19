'use client'

import { useEffect } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useDashboardEmpresa } from '../../../dashboard/empresa/hooks/useDashboardEmpresa'
import { useEmpresaServicosPlano } from '@/hooks/useEmpresaServicosPlano'
import AvisoPlanoEmpresaBloqueado from '@/components/empresa/AvisoPlanoEmpresaBloqueado'

/** Redireciona para o Chat ADM unificado quando o plano libera o recurso. */
export default function ChatAdmEmpresaRedirectPage() {
  const router = useRouter()
  const { dados, loading: empresaLoading } = useDashboardEmpresa()
  const { featureLiberada, loading } = useEmpresaServicosPlano(dados?.plano, dados?.id, {
    aguardarEmpresa: empresaLoading,
  })

  useEffect(() => {
    if (loading) return
    if (featureLiberada('pagina_rede_social')) {
      router.replace('/chat-adm')
    }
  }, [featureLiberada, loading, router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">A carregar…</p>
      </div>
    )
  }

  if (!featureLiberada('pagina_rede_social')) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <AvisoPlanoEmpresaBloqueado />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <p className="text-sm text-gray-500">Abrindo Chat ADM...</p>
    </div>
  )
}
