'use client'

import { Suspense, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import PublicidadeHome from '@/components/PublicidadeHome'
import GradeFiltros from '@/components/GradeFiltros'
import ConclusaoAtendimentoMobilidadeListener from '@/components/mobilidade/ConclusaoAtendimentoMobilidadeListener'
import CabecalhoAbasGuiaMobilidade from '@/components/mobilidade/CabecalhoAbasGuiaMobilidade'
import VisaoTuristaMobilidade from '@/components/mobilidade/VisaoTuristaMobilidade'

export default function GuiaPage() {
  const router = useRouter()
  const [abaAtiva, setAbaAtiva] = useState<'guia' | 'mobilidade'>('guia')

  const handleFiltroClick = (filtroId: string) => {
    if (filtroId === 'compras') {
      router.push('/compras-cde')
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
