'use client'

import { useEffect, useState } from 'react'
import { useDashboardEmpresa } from '@/app/[locale]/(app-shell)/dashboard/empresa/hooks/useDashboardEmpresa'
import { buscarSolicitacaoAuxiliarAdmEmpresa } from '@/lib/empresaAuxiliarAdm'
import { supabase } from '@/lib/supabase'

export default function AuxiliarAdm() {
  const { dados: empresa } = useDashboardEmpresa()
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<'pendente' | 'atribuido' | null>(null)

  useEffect(() => {
    if (!empresa?.id) {
      setLoading(false)
      setStatus(null)
      return
    }
    let ativo = true
    void (async () => {
      setLoading(true)
      try {
        const sol = await buscarSolicitacaoAuxiliarAdmEmpresa(supabase, empresa.id)
        if (!ativo) return
        setStatus(sol?.status === 'atribuido' ? 'atribuido' : sol ? 'pendente' : null)
      } catch {
        if (ativo) setStatus(null)
      } finally {
        if (ativo) setLoading(false)
      }
    })()
    return () => {
      ativo = false
    }
  }, [empresa?.id])

  if (loading) {
    return (
      <div className="space-y-4 pt-4" aria-busy="true">
        <div className="h-24 animate-pulse rounded-lg bg-gray-200" />
      </div>
    )
  }

  return (
    <div className="space-y-4 pt-4">
      <div className="rounded-lg border bg-white p-5">
        <h2 className="text-base font-bold text-gray-900">Auxiliar ADM</h2>
        <p className="mt-2 text-sm text-gray-600">
          Com o plano Auxiliar ADM contratado, a equipe do Guia atribui um moderador dedicado à sua empresa.
        </p>
        {status === 'pendente' ? (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Solicitação enviada ao ADM Geral. Aguarde a atribuição do moderador.
          </p>
        ) : status === 'atribuido' ? (
          <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Moderador atribuído. O suporte dedicado entrará em contacto pelo Chat ADM.
          </p>
        ) : (
          <p className="mt-4 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
            Nenhuma solicitação ativa. Ao contratar um plano com Auxiliar ADM, a solicitação é criada automaticamente.
          </p>
        )}
      </div>
    </div>
  )
}
