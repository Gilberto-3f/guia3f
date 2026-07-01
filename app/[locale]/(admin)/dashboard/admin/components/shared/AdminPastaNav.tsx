'use client'

import type { LucideIcon } from 'lucide-react'
import { BarChart3, ClipboardCheck, ShieldAlert, Crown, Settings, Table2 } from 'lucide-react'
import { ABAS_PRINCIPAIS, type AbaPrincipalId } from './AbasNavegacao'
import { CadastroBadgesPar, CadastroVerificacaoBadge } from '../verificacao/CadastroBadges'

export const ADMIN_PASTAS: { id: AbaPrincipalId; label: string; Icon: LucideIcon }[] = [
  { id: 'visao-geral', label: 'Ecossistema', Icon: BarChart3 },
  { id: 'cadastros', label: 'Cadastros', Icon: ClipboardCheck },
  { id: 'denuncias', label: 'Denúncias', Icon: ShieldAlert },
  { id: 'servicos-tabelados', label: 'Serviços Tabelados', Icon: Table2 },
  { id: 'espaco-adm', label: 'Espaço ADM', Icon: Crown },
  { id: 'configuracoes', label: 'Configurações', Icon: Settings },
]

const PASTA_LABEL: Record<AbaPrincipalId, string> = Object.fromEntries(
  ADMIN_PASTAS.map((p) => [p.id, p.label]),
) as Record<AbaPrincipalId, string>

export function tituloPastaAdmin(tab: AbaPrincipalId): string {
  return PASTA_LABEL[tab] ?? 'Painel Dashboard'
}

export function pastaAdminPorId(tab: AbaPrincipalId) {
  return ADMIN_PASTAS.find((p) => p.id === tab)
}

export function AdminPastaNav({
  onSelect,
  pastas = ADMIN_PASTAS,
  cadastrosVerificacoes = 0,
  cadastrosExclusoes = 0,
  mostrarBadgeExclusaoCadastros = false,
  denunciasPendentes = 0,
  denunciasExclusoes = 0,
  mostrarBadgeExclusaoDenuncias = false,
  espacoAdmBeneficios = 0,
}: {
  onSelect: (id: AbaPrincipalId) => void
  cadastrosVerificacoes?: number
  cadastrosExclusoes?: number
  mostrarBadgeExclusaoCadastros?: boolean
  denunciasPendentes?: number
  denunciasExclusoes?: number
  mostrarBadgeExclusaoDenuncias?: boolean
  /** Ofertas de comissão pendentes (Análise de Benefícios). */
  espacoAdmBeneficios?: number
  /** Subconjunto de pastas (permissão por colaborador). */
  pastas?: typeof ADMIN_PASTAS
}) {
  return (
    <nav className="space-y-2" aria-label="Seções do painel administrativo">
      {pastas.map(({ id, label, Icon }) => (
        <section
          key={id}
          className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
          aria-labelledby={`admin-pasta-${id}`}
        >
          <button
            type="button"
            id={`admin-pasta-${id}`}
            onClick={() => onSelect(id)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50/80 sm:py-3.5"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0097b2] sm:h-11 sm:w-11">
              <Icon className="h-5 w-5 text-white sm:h-6 sm:w-6" strokeWidth={2} aria-hidden />
            </span>
            <span className="min-w-0 flex-1 text-base font-bold uppercase tracking-wide text-[#0097b2] sm:text-lg">
              {label}
            </span>
            {id === 'cadastros' ? (
              <CadastroBadgesPar
                verificacoes={cadastrosVerificacoes}
                exclusoes={cadastrosExclusoes}
                mostrarExclusao={mostrarBadgeExclusaoCadastros}
                className="shrink-0"
              />
            ) : null}
            {id === 'denuncias' ? (
              <CadastroBadgesPar
                verificacoes={denunciasPendentes}
                exclusoes={denunciasExclusoes}
                mostrarExclusao={mostrarBadgeExclusaoDenuncias}
                className="shrink-0"
              />
            ) : null}
            {id === 'espaco-adm' ? (
              <CadastroVerificacaoBadge count={espacoAdmBeneficios} className="shrink-0" />
            ) : null}
          </button>
        </section>
      ))}
    </nav>
  )
}
