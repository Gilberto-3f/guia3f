'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDown, type LucideIcon } from 'lucide-react'
import CanalNaoLidasBadge from '@/components/CanalNaoLidasBadge'

const CLASSE_ICONE =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#0097b2] text-white'

interface Props {
  id: string
  rotulo: string
  total: number
  icon: LucideIcon
  children?: ReactNode
  aberto?: boolean
  onToggle?: () => void
  controlado?: boolean
  naoLidas?: number
  posicao?: number
  /** false = linha de ranking sem expandir (relatório agregado). */
  expandivel?: boolean
}

export default function PastaRelatorioLista({
  id,
  rotulo,
  total,
  icon: Icon,
  children,
  aberto: abertoProp,
  onToggle,
  controlado = false,
  naoLidas = 0,
  posicao,
  expandivel = true,
}: Props) {
  const [abertoLocal, setAbertoLocal] = useState(false)
  const aberto = controlado ? Boolean(abertoProp) : abertoLocal

  const toggle = () => {
    if (!expandivel) return
    if (controlado) {
      onToggle?.()
    } else {
      setAbertoLocal((v) => !v)
    }
  }

  const textoBloco = (
    <div className="min-w-0 flex-1">
      <div className="flex min-w-0 items-center gap-2 text-[15px] font-normal text-gray-900">
        {posicao != null ? (
          <span className="shrink-0 tabular-nums text-sm font-bold text-[#0097b2]">{posicao}º</span>
        ) : null}
        <span className="min-w-0 leading-snug">{rotulo}</span>
      </div>
      <p
        className={`mt-0.5 text-sm font-semibold tabular-nums text-[#001f3f] ${posicao != null ? 'pl-7' : ''}`}
      >
        {total.toLocaleString('pt-BR')}
      </p>
    </div>
  )

  const conteudoLinha = (
    <>
      <div className={CLASSE_ICONE}>
        <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-between gap-2 border-b border-gray-200/80 py-3">
        {textoBloco}
        {expandivel ? (
          <div className="flex shrink-0 flex-col items-center gap-0.5 self-center">
            <ChevronDown
              className={`h-5 w-5 shrink-0 text-gray-400 transition-transform duration-200 ${aberto ? 'rotate-180' : ''}`}
              aria-hidden
            />
            <CanalNaoLidasBadge count={naoLidas} />
          </div>
        ) : null}
      </div>
    </>
  )

  return (
    <div>
      {expandivel ? (
        <button
          type="button"
          id={`pasta-${id}`}
          onClick={toggle}
          className="flex w-full items-center gap-3 text-left transition-colors hover:bg-gray-50/60"
          aria-expanded={aberto}
        >
          {conteudoLinha}
        </button>
      ) : (
        <div id={`pasta-${id}`} className="flex w-full items-center gap-3 text-left">
          {conteudoLinha}
        </div>
      )}

      {expandivel && aberto ? <div className="pb-2 pl-10 pt-0.5">{children}</div> : null}
    </div>
  )
}
