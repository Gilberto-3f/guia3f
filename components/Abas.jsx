'use client'

import { useTranslations } from 'next-intl'

/**
 * @param {{ activeTab: 'guia' | 'mobilidade', onTabChange: (tab: 'guia' | 'mobilidade') => void }} props
 */
export default function Abas({ activeTab, onTabChange }) {
  const t = useTranslations('Guia')

  return (
    <div className="flex justify-center gap-8 px-4 pb-4">
      <button
        type="button"
        onClick={() => onTabChange('guia')}
        className={`pb-2 text-sm font-semibold transition-colors ${
          activeTab === 'guia'
            ? 'border-b-2 border-white text-white'
            : 'border-b-2 border-transparent text-white/70 hover:text-white/90'
        }`}
      >
        {t('tabGuia')}
      </button>
      <button
        type="button"
        onClick={() => onTabChange('mobilidade')}
        className={`pb-2 text-sm font-semibold transition-colors ${
          activeTab === 'mobilidade'
            ? 'border-b-2 border-white text-white'
            : 'border-b-2 border-transparent text-white/70 hover:text-white/90'
        }`}
      >
        {t('tabMobilidade')}
      </button>
    </div>
  )
}
