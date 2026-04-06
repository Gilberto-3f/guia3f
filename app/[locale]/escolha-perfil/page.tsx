'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import GuiaAuthShell from '@/components/GuiaAuthShell'

const VERDE = '#00D443'

type PerfilKey = 'turista' | 'profissional' | 'empresa'

const BENEFIT_KEYS = ['b1', 'b2', 'b3', 'b4', 'b5'] as const

function BeneficioLinha({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm text-[#001f3f]">
      <span className="shrink-0 font-bold text-[#0097b2]">→</span>
      <span>{children}</span>
    </li>
  )
}

function PainelBeneficios({ perfil }: { perfil: PerfilKey }) {
  const t = useTranslations('EscolhaPerfil')
  const router = useRouter()

  return (
    <div className="mt-3 rounded-xl bg-[#f5f5f5] p-4 sm:p-5">
      <p className="mb-2 font-bold text-[#0097b2]">{t(`${perfil}.welcome`)}</p>
      <p className="mb-4 text-sm leading-relaxed text-[#001f3f]">{t(`${perfil}.intro`)}</p>
      <p className="mb-2 text-sm font-medium text-[#001f3f]">{t(`${perfil}.benefitsLead`)}</p>
      <ul className="mb-6 space-y-2">
        {BENEFIT_KEYS.map((k) => (
          <BeneficioLinha key={k}>{t(`${perfil}.${k}`)}</BeneficioLinha>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => router.push(`/cadastro/${perfil}`)}
        className="w-full rounded-full py-3 text-base font-bold text-white transition-colors hover:bg-[#00b838]"
        style={{ backgroundColor: VERDE }}
      >
        {t('register')}
      </button>
    </div>
  )
}

export default function EscolhaPerfilPage() {
  const router = useRouter()
  const t = useTranslations('EscolhaPerfil')
  const [aberto, setAberto] = useState<PerfilKey | null>(null)
  const [verificandoSessao, setVerificandoSessao] = useState(true)

  useEffect(() => {
    let ativo = true
    const run = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!ativo) return
      if (!session?.user) {
        router.replace('/login')
        return
      }
      setVerificandoSessao(false)
    }
    void run()
    return () => {
      ativo = false
    }
  }, [router])

  const toggle = (key: PerfilKey) => {
    setAberto((prev) => (prev === key ? null : key))
  }

  if (verificandoSessao) {
    return (
      <GuiaAuthShell>
        <p className="text-center text-[#001f3f]">{t('loading')}</p>
      </GuiaAuthShell>
    )
  }

  const btnPerfilBase =
    'mx-auto block w-full max-w-64 rounded-lg py-3.5 text-center text-lg font-bold transition-shadow sm:max-w-xs'

  return (
    <GuiaAuthShell
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
              onClick={() => toggle(key)}
              className={`${btnPerfilBase} shadow-md ${
                aberto === key
                  ? 'bg-[#0097b2] text-white'
                  : 'border-2 border-[#0097b2] bg-white text-[#0097b2] shadow-[0_2px_8px_rgba(0,151,178,0.2)]'
              }`}
            >
              {t(`${key}.label`)}
            </button>
            {aberto === key ? <PainelBeneficios perfil={key} /> : null}
          </div>
        ))}
      </div>
    </GuiaAuthShell>
  )
}
