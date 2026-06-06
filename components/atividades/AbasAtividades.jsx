'use client'

import { User, UserCheck } from 'lucide-react'

/**
 * @param {{
 *   aba: 'amigos' | 'minha'
 *   onAba: (a: 'amigos' | 'minha') => void
 *   somenteMinhaConta?: boolean
 * }} props
 */
export default function AbasAtividades({ aba, onAba, somenteMinhaConta = false }) {
  const tabCls = (ativo) =>
    `flex min-w-0 flex-1 items-center justify-center gap-2 border-b-[3px] py-3 text-center text-sm font-semibold tracking-wide transition-colors sm:text-base ${
      ativo ? 'border-[#0097b2] text-[#0097b2]' : 'border-transparent text-gray-500'
    }`

  if (somenteMinhaConta) {
    return null
  }

  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="flex w-full">
        <button type="button" className={tabCls(aba === 'amigos')} onClick={() => onAba('amigos')}>
          <UserCheck className="h-5 w-5 shrink-0 sm:h-[1.35rem] sm:w-[1.35rem]" strokeWidth={2} aria-hidden />
          SEGUINDO
        </button>
        <button type="button" className={tabCls(aba === 'minha')} onClick={() => onAba('minha')}>
          <User className="h-5 w-5 shrink-0 sm:h-[1.35rem] sm:w-[1.35rem]" strokeWidth={2} aria-hidden />
          MINHA CONTA
        </button>
      </div>
    </div>
  )
}
