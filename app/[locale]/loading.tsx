'use client'

import { useTranslations } from 'next-intl'

export default function Loading() {
  const t = useTranslations('Common')
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="animate-pulse text-gray-400">{t('loading')}</div>
    </div>
  )
}
