'use client'

/**
 * @param {{
 *   aba: 'amigos' | 'minha'
 *   onAba: (a: 'amigos' | 'minha') => void
 *   naoLidasAmigos: number
 *   naoLidasMinha: number
 * }} props
 */
export default function AbasAtividades({ aba, onAba, naoLidasAmigos, naoLidasMinha }) {
  const tabCls = (ativo) =>
    `flex-1 py-3 text-center text-sm font-semibold tracking-wide transition-colors ${
      ativo ? 'border-b-[3px] border-[#0097b2] text-[#0097b2]' : 'border-b-[3px] border-transparent text-gray-500'
    }`

  return (
    <div className="flex border-b border-gray-200 bg-white">
      <button type="button" className={tabCls(aba === 'amigos')} onClick={() => onAba('amigos')}>
        AMIGOS
        <span className="ml-1 text-xs font-normal text-gray-400">({naoLidasAmigos})</span>
      </button>
      <button type="button" className={tabCls(aba === 'minha')} onClick={() => onAba('minha')}>
        MINHA CONTA
        <span className="ml-1 text-xs font-normal text-gray-400">({naoLidasMinha})</span>
      </button>
    </div>
  )
}
