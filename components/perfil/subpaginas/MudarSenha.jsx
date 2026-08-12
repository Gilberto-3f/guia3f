'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { supabase } from '@/lib/supabase'

/**
 * @param {{ onSucesso?: () => void }} props
 */
export default function MudarSenha({ onSucesso }) {
  const t = useTranslations('MudarSenha')
  const locale = useLocale()
  const [senhaAtual, setSenhaAtual] = useState('')
  const [senhaNova, setSenhaNova] = useState('')
  const [senhaConfirma, setSenhaConfirma] = useState('')
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const [loading, setLoading] = useState(false)

  const senhaRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/

  const enviar = async (e) => {
    e.preventDefault()
    setErro('')
    setOk('')

    if (!senhaAtual) {
      setErro(t('valCurrent'))
      return
    }
    if (!senhaRegex.test(senhaNova)) {
      setErro(t('valPassword'))
      return
    }
    if (senhaNova !== senhaConfirma) {
      setErro(t('valMatch'))
      return
    }
    if (senhaAtual === senhaNova) {
      setErro(t('valSame'))
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/conta/alterar-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senhaAtual,
          senhaNova,
          locale: locale === 'en' || locale === 'es' ? locale : 'pt',
        }),
      })
      const data = await res.json().catch(() => ({}))

      if (res.status === 429) {
        const min = Math.max(1, Math.ceil(Number(data.retryAfterSec || 900) / 60))
        setErro(t('locked', { minutes: min }))
        return
      }
      if (res.status === 401 && data.error === 'wrong_password') {
        setErro(t('wrongPassword', { remaining: data.remainingAttempts ?? 0 }))
        return
      }
      if (!res.ok) {
        if (data.error === 'invalid_password') setErro(t('valPassword'))
        else if (data.error === 'same_password') setErro(t('valSame'))
        else setErro(t('genericError'))
        return
      }

      try {
        await supabase.auth.signOut({ scope: 'others' })
      } catch (signOutErr) {
        console.warn('[MudarSenha] signOut others', signOutErr)
      }

      setSenhaAtual('')
      setSenhaNova('')
      setSenhaConfirma('')
      setOk(t('success'))
      onSucesso?.()
    } catch {
      setErro(t('genericError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-4 px-1 pb-4">
      <p className="text-sm text-gray-600">{t('hint')}</p>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-600">{t('current')}</span>
        <input
          type="password"
          autoComplete="current-password"
          value={senhaAtual}
          onChange={(ev) => setSenhaAtual(ev.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#0097b2]"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-600">{t('next')}</span>
        <input
          type="password"
          autoComplete="new-password"
          value={senhaNova}
          onChange={(ev) => setSenhaNova(ev.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#0097b2]"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-600">{t('confirm')}</span>
        <input
          type="password"
          autoComplete="new-password"
          value={senhaConfirma}
          onChange={(ev) => setSenhaConfirma(ev.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#0097b2]"
        />
      </label>

      {erro ? <p className="text-sm text-red-600">{erro}</p> : null}
      {ok ? <p className="text-sm text-green-700">{ok}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg py-3 text-sm font-bold uppercase tracking-wide text-white transition disabled:opacity-60"
        style={{ backgroundColor: '#00D443' }}
      >
        {loading ? t('saving') : t('confirmButton')}
      </button>

      <p className="text-center text-sm text-gray-500">
        <Link href="/recuperar-senha" className="font-medium underline" style={{ color: '#0097b2' }}>
          {t('forgot')}
        </Link>
      </p>
    </form>
  )
}
