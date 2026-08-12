'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { supabase } from '@/lib/supabase'

export default function ExcluirConta() {
  const t = useTranslations('ExcluirConta')
  const locale = useLocale()
  const router = useRouter()
  const [passo, setPasso] = useState(1)
  const [senhaAtual, setSenhaAtual] = useState('')
  const [confirmou, setConfirmou] = useState(false)
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  const enviar = async (e) => {
    e.preventDefault()
    setErro('')

    if (!confirmou) {
      setErro(t('valConfirm'))
      return
    }
    if (!senhaAtual) {
      setErro(t('valCurrent'))
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/conta/excluir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senhaAtual,
          confirmou: true,
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
      if (res.status === 409) {
        if (data.error === 'active_ride') setErro(t('activeRide'))
        else if (data.error === 'active_reservation') setErro(t('activeReservation'))
        else if (data.error === 'active_manifesto') setErro(t('activeManifesto'))
        else setErro(t('genericError'))
        return
      }
      if (res.status === 403) {
        setErro(t('adminForbidden'))
        return
      }
      if (res.status === 503 && data.error === 'rpc_missing') {
        setErro(t('rpcMissing'))
        return
      }
      if (!res.ok) {
        setErro(t('genericError'))
        return
      }

      try {
        await supabase.auth.signOut({ scope: 'global' })
      } catch {
        /* sessão já inválida após deleteUser */
      }
      router.push('/login')
    } catch {
      setErro(t('genericError'))
    } finally {
      setLoading(false)
    }
  }

  if (passo === 1) {
    return (
      <div className="space-y-4 px-1 pb-4">
        <p className="text-sm font-semibold text-gray-900">{t('warningTitle')}</p>
        <ul className="list-disc space-y-2 pl-5 text-sm text-gray-600">
          <li>{t('warningAccess')}</li>
          <li>{t('warningData')}</li>
          <li>{t('warningLegal')}</li>
        </ul>
        <button
          type="button"
          onClick={() => setPasso(2)}
          className="w-full rounded-lg py-3 text-sm font-bold uppercase tracking-wide text-white"
          style={{ backgroundColor: '#0097b2' }}
        >
          {t('continue')}
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={enviar} className="space-y-4 px-1 pb-4">
      <p className="text-sm text-gray-600">{t('step2Hint')}</p>

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

      <label className="flex items-start gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={confirmou}
          onChange={(ev) => setConfirmou(ev.target.checked)}
          className="mt-1 h-4 w-4 shrink-0"
        />
        <span>{t('checkbox')}</span>
      </label>

      {erro ? <p className="text-sm text-red-600">{erro}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg py-3 text-sm font-bold uppercase tracking-wide text-white transition disabled:opacity-60"
        style={{ backgroundColor: '#dc2626' }}
      >
        {loading ? t('saving') : t('confirmButton')}
      </button>

      <button
        type="button"
        onClick={() => {
          setPasso(1)
          setErro('')
        }}
        className="w-full py-2 text-sm font-medium text-gray-500"
      >
        {t('back')}
      </button>
    </form>
  )
}
