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
      <p className="px-4 pb-3 text-xs leading-snug text-gray-500">
        {aba === 'amigos' ? (
          <>
            Atividades de <strong className="font-medium text-gray-600">quem você segue</strong>: curtidas, comentários,
            novos seguidores e avaliações que eles fizeram.
          </>
        ) : (
          <>
            <strong className="font-medium text-gray-600">Sua caixa de notificações</strong>: interações com seus posts e
            perfil (curtidas, comentários, seguidores novos, etc.).
          </>
        )}
      </p>
    </div>
  )
}
