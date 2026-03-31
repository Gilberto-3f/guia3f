'use client'

import { useTranslations } from 'next-intl'

/**
 * @param {{ activeTab: 'guia' | 'mobilidade', onTabChange: (tab: 'guia' | 'mobilidade') => void }} props
 */
export default function Abas({ activeTab, onTabChange }) {
  const t = useTranslations('Guia')

  return (
    <div className="border-b border-gray-100 bg-white px-4">
      <div className="flex gap-4">
        <button
          type="button"
          onClick={() => onTabChange('guia')}
          className={`relative px-4 py-3 font-medium transition-colors ${
            activeTab === 'guia' ? 'text-[#0097b2]' : 'text-gray-500'
          }`}
        >
          {t('tabGuia')}
          {activeTab === 'guia' ? (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-[#0097b2]" />
          ) : null}
        </button>
        <button
          type="button"
          onClick={() => onTabChange('mobilidade')}
          className={`relative px-4 py-3 font-medium transition-colors ${
            activeTab === 'mobilidade' ? 'text-[#0097b2]' : 'text-gray-500'
          }`}
        >
          {t('tabMobilidade')}
          {activeTab === 'mobilidade' ? (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-[#0097b2]" />
          ) : null}
        </button>
      </div>
    </div>
  )
}
