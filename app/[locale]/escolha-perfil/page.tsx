'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import GuiaAuthShell from '@/components/GuiaAuthShell'

export default function EscolhaPerfilPage() {
  const router = useRouter()
  const t = useTranslations('EscolhaPerfil')

  const btnPerfilBase =
    'mx-auto block w-full max-w-64 rounded-lg py-3.5 text-center text-lg font-bold transition-shadow sm:max-w-xs'

  return (
    <GuiaAuthShell
      largeHeaderLogo
      footer={
        <div className="border-t border-gray-100 px-5 py-4 text-center text-sm text-gray-500 sm:px-6">
          <Link href="/politicas" className="text-[#0097b2] hover:underline">
            {t('footerPrivacy')}
          </Link>
          <span className="mx-2">|</span>
          <Link href="/regras" className="text-[#0097b2] hover:underline">
            {t('footerRules')}
          </Link>
        </div>
      }
    >
      <h1 className="mb-8 text-center text-xl font-bold text-[#0097b2] sm:text-2xl">{t('title')}</h1>

      <div className="space-y-5">
        {(['turista', 'profissional', 'empresa'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => router.push(`/cadastro/${key}`)}
            className={`${btnPerfilBase} border-2 border-[#0097b2] bg-white text-[#0097b2] shadow-md shadow-[0_2px_8px_rgba(0,151,178,0.2)] transition-colors hover:bg-[#0097b2] hover:text-white`}
          >
            {t(`${key}.label`)}
          </button>
        ))}
      </div>
    </GuiaAuthShell>
  )
}
