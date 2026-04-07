'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import GuiaAuthShell from '@/components/GuiaAuthShell'

type PerfilKey = 'turista' | 'profissional' | 'empresa'

function PainelCadastro({ perfil }: { perfil: PerfilKey }) {
  const t = useTranslations('EscolhaPerfil')
  const router = useRouter()

  return (
    <div className="mt-3 rounded-xl bg-[#f5f5f5] p-4 sm:p-5">
      <p className="mb-4 text-sm leading-relaxed text-[#001f3f]">{t(`${perfil}.panelBody`)}</p>
      <button
        type="button"
        onClick={() => router.push(`/cadastro/${perfil}`)}
        className="mx-auto block w-full max-w-xs rounded-full bg-[#00D443] py-2 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-[#00b838]"
      >
        {t('register')}
      </button>
    </div>
  )
}

export default function EscolhaPerfilPage() {
  const t = useTranslations('EscolhaPerfil')
  const [painelAberto, setPainelAberto] = useState<PerfilKey | null>(null)

  const alternarPainel = (key: PerfilKey) => {
    setPainelAberto((prev) => (prev === key ? null : key))
  }

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
          <div key={key}>
            <button
              type="button"
              onClick={() => alternarPainel(key)}
              className={`${btnPerfilBase} shadow-md ${
                painelAberto === key
                  ? 'bg-[#0097b2] text-white'
                  : 'border-2 border-[#0097b2] bg-white text-[#0097b2] shadow-[0_2px_8px_rgba(0,151,178,0.2)]'
              }`}
            >
              {t(`${key}.label`)}
            </button>
            {painelAberto === key ? <PainelCadastro perfil={key} /> : null}
          </div>
        ))}
      </div>
    </GuiaAuthShell>
  )
}
