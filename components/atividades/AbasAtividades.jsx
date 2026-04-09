'use client'

/**
 * @param {{
 *   aba: 'amigos' | 'minha'
 *   onAba: (a: 'amigos' | 'minha') => void
 * }} props
 */
export default function AbasAtividades({ aba, onAba }) {
  const tabCls = (ativo) =>
    `flex-1 py-3 text-center text-sm font-semibold tracking-wide transition-colors ${
      ativo ? 'border-b-[3px] border-[#0097b2] text-[#0097b2]' : 'border-b-[3px] border-transparent text-gray-500'
    }`

  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="flex">
        <button type="button" className={tabCls(aba === 'amigos')} onClick={() => onAba('amigos')}>
          AMIGOS
        </button>
        <button type="button" className={tabCls(aba === 'minha')} onClick={() => onAba('minha')}>
          MINHA CONTA
        </button>
      </div>
    </div>
  )
}
