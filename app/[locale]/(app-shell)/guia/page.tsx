'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { destinoTileSextoHome } from '@/lib/ecossistemas'
import PublicidadeHome from '@/components/PublicidadeHome'
import GradeFiltros from '@/components/GradeFiltros'
import ConclusaoAtendimentoMobilidadeListener from '@/components/mobilidade/ConclusaoAtendimentoMobilidadeListener'
import CabecalhoAbasGuiaMobilidade from '@/components/mobilidade/CabecalhoAbasGuiaMobilidade'
import VisaoTuristaMobilidade from '@/components/mobilidade/VisaoTuristaMobilidade'
import { useEcossistemaAtivo } from '@/context/EcossistemaAtivoContext'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import { chromeHomePintado, marcarHomeChromePronto } from '@/lib/appSplashReady'
import { refreshAppViewportHeight } from '@/lib/useAppViewportHeight'

export default function GuiaPage() {
  const router = useRouter()
  const [abaAtiva, setAbaAtiva] = useState<'guia' | 'mobilidade'>('guia')
  const { carregou: ecoCarregou } = useEcossistemaAtivo()
  const { bootConcluido } = useProfissionalGate()

  useEffect(() => {
    if (!ecoCarregou || !bootConcluido) return
    let cancel = false
    let raf = 0
    const tick = () => {
      if (cancel) return
      if (chromeHomePintado()) {
        raf = window.requestAnimationFrame(() => {
          raf = window.requestAnimationFrame(() => {
            if (cancel) return
            refreshAppViewportHeight()
            marcarHomeChromePronto()
          })
        })
        return
      }
      raf = window.requestAnimationFrame(tick)
    }
    tick()
    return () => {
      cancel = true
      window.cancelAnimationFrame(raf)
    }
  }, [ecoCarregou, bootConcluido])

  const handleFiltroClick = (filtroId: string) => {
    if (filtroId === 'aguarde') return
    const destSexto =
      filtroId === 'compras' || filtroId === 'compras_cde'
        ? destinoTileSextoHome('compras_cde')
        : filtroId === 'servicos_locais_sexto'
          ? destinoTileSextoHome('servicos_locais')
          : null
    if (destSexto) {
      router.push(destSexto)
      return
    }
    router.push(`/guia/${filtroId}`)
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-gray-50">
      <CabecalhoAbasGuiaMobilidade
        abaAtiva={abaAtiva}
        onAbaGuia={() => setAbaAtiva('guia')}
        onAbaMobilidade={() => setAbaAtiva('mobilidade')}
      />

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden" style={{ flex: '1 1 0%' }}>
        {abaAtiva === 'mobilidade' ? (
          <Suspense
            fallback={
              <div className="flex flex-1 items-center justify-center bg-[#e8f4f6] text-sm text-gray-500">
                Carregando mapa…
              </div>
            }
          >
            <VisaoTuristaMobilidade />
          </Suspense>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-20">
            <GradeFiltros onFiltroClick={handleFiltroClick} />
            <p className="mb-1 mt-2 text-center text-xs text-[#0097b2]">Espaço Publicitário</p>
            <PublicidadeHome />
          </div>
        )}
      </main>
      {abaAtiva !== 'mobilidade' ? <ConclusaoAtendimentoMobilidadeListener /> : null}
    </div>
  )
}
