'use client'

import { createPortal } from 'react-dom'
import { Handshake, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import ParceriasProfissional from '@/components/perfil/subpaginas/ParceriasProfissional'
import { useModalScrollLock } from '@/lib/useModalScrollLock'

const COR = '#0097b2'

type Props = {
  aberto: boolean
  onFechar: () => void
  /** Aba inicial do histórico de parcerias. */
  abaInicial?: 'andamento' | 'historico'
}

/** Drawer Histórico vendas + parcerias no Espaço Profissional. */
export default function DrawerHistoricoParceriasEspaco({
  aberto,
  onFechar,
  abaInicial = 'andamento',
}: Props) {
  const t = useTranslations('Mobilidade')
  useModalScrollLock(aberto)

  if (!aberto) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex flex-col bg-white"
      style={{ height: 'var(--app-height, 100dvh)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-historico-parcerias-titulo"
    >
      <div className="shrink-0 pt-safe" style={{ backgroundColor: COR }}>
        <div className="flex h-12 items-center gap-2 px-3">
          <Handshake className="h-5 w-5 shrink-0 text-white" aria-hidden />
          <h2
            id="drawer-historico-parcerias-titulo"
            className="min-w-0 flex-1 truncate text-base font-bold uppercase tracking-wide text-white"
          >
            {t('espacoAcao.parcerias.titulo')}
          </h2>
          <button
            type="button"
            onClick={onFechar}
            className="rounded-lg p-2 text-white/90 hover:bg-white/15"
            aria-label={t('fechar')}
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4" data-modal-scroll-lock-scrollable>
        <ParceriasProfissional compact abaInicial={abaInicial} />
      </div>
    </div>,
    document.body,
  )
}
