'use client'

import type { LucideIcon } from 'lucide-react'
import { BarChart3, ClipboardCheck, ShieldAlert, Crown, Settings } from 'lucide-react'
import { ABAS_PRINCIPAIS, type AbaPrincipalId } from './AbasNavegacao'

export const ADMIN_PASTAS: { id: AbaPrincipalId; label: string; Icon: LucideIcon }[] = [
  { id: 'visao-geral', label: 'Visão geral', Icon: BarChart3 },
  { id: 'cadastros', label: 'Cadastros', Icon: ClipboardCheck },
  { id: 'denuncias', label: 'Denúncias', Icon: ShieldAlert },
  { id: 'espaco-adm', label: 'Espaço ADM', Icon: Crown },
  { id: 'configuracoes', label: 'Configurações', Icon: Settings },
]

const PASTA_LABEL: Record<AbaPrincipalId, string> = Object.fromEntries(
  ADMIN_PASTAS.map((p) => [p.id, p.label]),
) as Record<AbaPrincipalId, string>

export function tituloPastaAdmin(tab: AbaPrincipalId): string {
  return PASTA_LABEL[tab] ?? 'Painel Dashboard'
}

export function AdminPastaNav({ onSelect }: { onSelect: (id: AbaPrincipalId) => void }) {
  return (
    <nav className="space-y-3" aria-label="Seções do painel administrativo">
      {ADMIN_PASTAS.map(({ id, label, Icon }) => (
        <section
          key={id}
          className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
          aria-labelledby={`admin-pasta-${id}`}
        >
          <button
            type="button"
            id={`admin-pasta-${id}`}
            onClick={() => onSelect(id)}
            className="flex w-full items-center gap-2.5 px-4 py-3.5 text-left transition-colors hover:bg-gray-50/80"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0097b2]">
              <Icon className="h-5 w-5 text-white" strokeWidth={2} aria-hidden />
            </span>
            <span className="text-xs font-bold uppercase tracking-wide text-[#0097b2] sm:text-sm">{label}</span>
          </button>
        </section>
      ))}
    </nav>
  )
}
