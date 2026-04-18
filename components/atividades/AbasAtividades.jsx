'use client'

import { Heart, User } from 'lucide-react'

/**
 * @param {{
 *   aba: 'amigos' | 'minha'
 *   onAba: (a: 'amigos' | 'minha') => void
 * }} props
 */
export default function AbasAtividades({ aba, onAba }) {
  const tabCls = (ativo) =>
    `flex flex-1 items-center justify-center gap-1.5 py-2 text-center text-xs font-semibold uppercase tracking-wide transition-colors sm:gap-2 sm:py-2.5 sm:text-sm ${
      ativo ? 'border-b-[3px] border-[#0097b2] text-[#0097b2]' : 'border-b-[3px] border-transparent text-gray-500'
    }`

  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="flex">
        <button type="button" className={tabCls(aba === 'amigos')} onClick={() => onAba('amigos')}>
          <Heart className="h-4 w-4 shrink-0 opacity-90 sm:h-[18px] sm:w-[18px]" strokeWidth={2.25} aria-hidden />
          ATIVIDADES
        </button>
        <button type="button" className={tabCls(aba === 'minha')} onClick={() => onAba('minha')}>
          <User className="h-4 w-4 shrink-0 opacity-90 sm:h-[18px] sm:w-[18px]" aria-hidden />
          MINHA CONTA
        </button>
      </div>
    </div>
  )
}
