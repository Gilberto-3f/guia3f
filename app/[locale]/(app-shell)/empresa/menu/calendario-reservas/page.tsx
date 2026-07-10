'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { useDashboardEmpresa } from '../../../dashboard/empresa/hooks/useDashboardEmpresa'
import EmpresaPaginaServicoGate from '@/components/empresa/EmpresaPaginaServicoGate'
import CalendarioReservasHospedagem from '@/components/perfil/subpaginas/CalendarioReservasHospedagem'

export default function CalendarioReservasPage() {
  const router = useRouter()
  const { dados: empresaDados } = useDashboardEmpresa()
  const empresaId = empresaDados?.id != null ? String(empresaDados.id) : ''

  const voltar = () => {
    if (empresaDados?.id) {
      router.push(`/empresa/${empresaDados.id}`)
      return
    }
    router.back()
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="sticky top-0 z-20 border-b border-white/15 bg-[#0097b2] pt-safe">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-4">
          <button
            type="button"
            onClick={() => voltar()}
            className="-ml-1 shrink-0 rounded-lg p-2 text-white hover:bg-white/15"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-white">Calendário de Reservas</h1>
            <p className="truncate text-xs text-white/80">Disponibilidade por acomodação</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-0 pb-6 pt-0">
        <EmpresaPaginaServicoGate servico="botao_dinamico">
          {empresaId ? <CalendarioReservasHospedagem empresaId={empresaId} /> : null}
        </EmpresaPaginaServicoGate>
      </div>
    </div>
  )
}
