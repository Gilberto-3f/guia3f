'use client'

import { useEffect } from 'react'
import { useRouter } from '@/i18n/navigation'
import AvisoDocsProfissionalBloqueado from '@/components/AvisoDocsProfissionalBloqueado'
import PopupAvisoBloqueioConta from '@/components/PopupAvisoBloqueioConta'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import { useGateComprasReservas } from '@/lib/useGateComprasReservas'

export default function MobilidadePage() {
  const router = useRouter()
  const { perfilEhProfissional, perfilEhTurista, recursosProfissionaisLiberados, loading } =
    useProfissionalGate()
  const {
    podeComprarReservar,
    avisarBloqueio,
    avisoAberto,
    fecharAvisoBloqueio,
    mensagemBloqueio,
    tituloBloqueio,
    loading: gateLoading,
  } = useGateComprasReservas()

  useEffect(() => {
    if (!perfilEhTurista || gateLoading || podeComprarReservar) return
    avisarBloqueio()
  }, [perfilEhTurista, gateLoading, podeComprarReservar, avisarBloqueio])

  if (perfilEhProfissional && (loading || !recursosProfissionaisLiberados)) {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-gray-50">
        <AvisoDocsProfissionalBloqueado />
      </div>
    )
  }

  if (perfilEhTurista && !gateLoading && !podeComprarReservar) {
    return (
      <>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-start bg-gray-50 px-4 py-10 text-center">
          <p className="text-sm text-gray-600">
            A mobilidade é liberada após verificação dos seus documentos pelo ADM ou pré-liberação de 24h por um
            profissional verificado.
          </p>
        </div>
        <PopupAvisoBloqueioConta
          aberto={avisoAberto || Boolean(mensagemBloqueio)}
          onFechar={() => {
            fecharAvisoBloqueio()
            router.replace('/guia')
          }}
          titulo={tituloBloqueio}
          mensagem={mensagemBloqueio}
        />
      </>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-gray-900">Mobilidade</h1>
      <p className="mt-2 text-gray-600">Destino e corrida em breve.</p>
    </div>
  )
}
