'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import GuiaAuthShell from '@/components/GuiaAuthShell'

type UsernameStatus = 'idle' | 'checking' | 'available' | 'unavailable'

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const senhaRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/
const usernameRegex = /^[a-z0-9._]{3,20}$/

function mapApiTuristaError(
  code: string | undefined,
  t: (key: string) => string
): string {
  switch (code) {
    case 'email_exists':
      return t('apiErrorEmailExists')
    case 'invalid_password':
    case 'invalid_password_format':
      return t('apiErrorInvalidPassword')
    case 'username_taken':
      return t('username.unavailable')
    case 'invalid_username':
      return t('turista.valUsername')
    case 'invalid_whatsapp':
      return t('turista.valWhatsapp')
    case 'server_config':
    case 'auth_database_error':
      return t('apiErrorServerConfig')
    case 'policies':
      return t('turista.valPolicies')
    default:
      if (code?.includes('documento_frente_url') || code?.includes('documento_verso_url')) {
        return t('apiErrorServerConfig')
      }
      return t('apiErrorDefault')
  }
}

export default function CadastroTuristaPage() {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('Cadastro')
  const tCommon = useTranslations('Common')

  const [nomeSocial, setNomeSocial] = useState('')
  const [nomeUsuario, setNomeUsuario] = useState('')
  const [whatsApp, setWhatsApp] = useState('')
  const [emailSessao, setEmailSessao] = useState('')
  const [senha, setSenha] = useState('')
  const [senhaConfirma, setSenhaConfirma] = useState('')
  const [modoLogado, setModoLogado] = useState(false)
  const [aceitePoliticas, setAceitePoliticas] = useState(false)

  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle')
  const [usernameFeedback, setUsernameFeedback] = useState('')
  const [erroEnvio, setErroEnvio] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [bootOk, setBootOk] = useState(false)

  const emailValido = useMemo(() => emailRegex.test(emailSessao), [emailSessao])
  const usernameLimpo = useMemo(
    () => nomeUsuario.trim().toLowerCase().replace(/^@+/, ''),
    [nomeUsuario]
  )

  useEffect(() => {
    let ativo = true
    const boot = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!ativo) return
      if (session?.user?.id) {
        const uid = session.user.id
        const { data: existente } = await supabase
          .from('turistas')
          .select('id')
          .eq('usuario_id', uid)
          .maybeSingle()
        if (!ativo) return
        if (existente) {
          router.replace('/guia')
          return
        }
        setEmailSessao((session.user.email ?? '').trim().toLowerCase())
        setModoLogado(true)
      }
      setBootOk(true)
    }
    void boot()
    return () => {
      ativo = false
    }
  }, [router])

  useEffect(() => {
    if (!usernameLimpo) {
      setUsernameStatus('idle')
      setUsernameFeedback('')
      return
    }

    if (!usernameRegex.test(usernameLimpo)) {
      setUsernameStatus('unavailable')
      setUsernameFeedback(t('username.rulesHint'))
      return
    }

    if (!modoLogado) {
      setUsernameStatus('available')
      setUsernameFeedback(t('username.available'))
      return
    }

    let ativo = true
    setUsernameStatus('checking')
    setUsernameFeedback(t('username.checking'))

    const timer = setTimeout(async () => {
      const [turistasResp, profissionaisResp, empresasResp] = await Promise.all([
        supabase.from('turistas').select('id').eq('nome_usuario', usernameLimpo).limit(1),
        supabase.from('profissionais').select('id').eq('nome_usuario', usernameLimpo).limit(1),
        supabase.from('empresas').select('id').eq('nome_usuario', usernameLimpo).limit(1),
      ])

      if (!ativo) return

      if (turistasResp.error || profissionaisResp.error || empresasResp.error) {
        setUsernameStatus('unavailable')
        setUsernameFeedback(t('username.validateError'))
        return
      }

      const indisponivel =
        (turistasResp.data?.length ?? 0) > 0 ||
        (profissionaisResp.data?.length ?? 0) > 0 ||
        (empresasResp.data?.length ?? 0) > 0

      if (indisponivel) {
        setUsernameStatus('unavailable')
        setUsernameFeedback(t('username.unavailable'))
      } else {
        setUsernameStatus('available')
        setUsernameFeedback(t('username.available'))
      }
    }, 400)

    return () => {
      ativo = false
      clearTimeout(timer)
    }
  }, [usernameLimpo, modoLogado, locale, t])

  const validarFormulario = () => {
    if (!nomeSocial.trim()) return t('turista.valSocialName')
    if (!usernameLimpo || usernameStatus !== 'available') return t('turista.valUsername')
    if (!whatsApp.trim()) return t('turista.valWhatsapp')
    if (!emailValido) return t('turista.valEmail')
    if (!aceitePoliticas) return t('turista.valPolicies')
    if (!modoLogado) {
      if (!senhaRegex.test(senha)) return t('apiErrorInvalidPassword')
      if (senha !== senhaConfirma) return t('signUpPasswordMatch')
    }
    return ''
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErroEnvio('')
    const erroValidacao = validarFormulario()
    if (erroValidacao) {
      setErroEnvio(erroValidacao)
      return
    }

    if (!modoLogado) {
      try {
        setEnviando(true)
        const fd = new FormData()
        fd.append('email', emailSessao.trim().toLowerCase())
        fd.append('password', senha)
        fd.append('nomeCompleto', nomeSocial.trim())
        fd.append('nomeUsuario', usernameLimpo)
        fd.append('whatsapp', whatsApp.trim())
        fd.append('aceitePoliticas', String(aceitePoliticas))
        fd.append('aceitePolitica', String(aceitePoliticas))
        fd.append('aceiteTermos', String(aceitePoliticas))

        const res = await fetch('/api/cadastro/turista', { method: 'POST', body: fd })
        const json = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          error?: string
        }
        if (!res.ok) {
          setErroEnvio(mapApiTuristaError(json.error, t))
          return
        }
        const emailLogin = emailSessao.trim().toLowerCase()
        const { error: signErr } = await supabase.auth.signInWithPassword({
          email: emailLogin,
          password: senha,
        })
        if (signErr) {
          setErroEnvio(signErr.message || t('apiErrorDefault'))
          return
        }
        await supabase.auth.getSession()
        router.push('/guia')
      } catch (error) {
        const mensagem = error instanceof Error ? error.message : t('unexpectedError')
        setErroEnvio(mensagem)
      } finally {
        setEnviando(false)
      }
      return
    }

    try {
      setEnviando(true)
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const userId = session?.user?.id
      const emailUser = (session?.user?.email ?? emailSessao).trim().toLowerCase()
      if (!userId || !emailUser) throw new Error(t('authUserError'))

      const upsertUsuario = await supabase.from('usuarios').upsert(
        {
          id: userId,
          email: emailUser,
          role: 'turista',
          status: 'pre_aprovado',
        },
        { onConflict: 'id' }
      )
      if (upsertUsuario.error) throw new Error(upsertUsuario.error.message)

      const payloadTurista: Record<string, string> = {
        usuario_id: userId,
        nome_completo: nomeSocial.trim(),
        nome_usuario: usernameLimpo,
        whatsapp: whatsApp.trim(),
        status: 'pre_aprovado',
      }
      let insertTurista = await supabase.from('turistas').insert(payloadTurista)
      if (insertTurista.error && insertTurista.error.message.toLowerCase().includes('status')) {
        delete payloadTurista.status
        insertTurista = await supabase.from('turistas').insert(payloadTurista)
      }
      if (insertTurista.error && insertTurista.error.message.toLowerCase().includes('whatsapp')) {
        delete payloadTurista.whatsapp
        insertTurista = await supabase.from('turistas').insert(payloadTurista)
      }
      if (insertTurista.error) throw new Error(insertTurista.error.message)

      router.push('/guia')
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : t('unexpectedError')
      setErroEnvio(mensagem)
    } finally {
      setEnviando(false)
    }
  }

  if (!bootOk) {
    return (
      <GuiaAuthShell largeHeaderLogo>
        <p className="text-center text-[#001f3f]">{tCommon('loading')}</p>
      </GuiaAuthShell>
    )
  }

  const inputCls =
    'w-full rounded-lg bg-[#0097b2] text-white placeholder-white/70 px-4 py-3 text-sm outline-none'

  return (
    <GuiaAuthShell largeHeaderLogo>
      <h1 className="mb-2 text-center text-xl font-bold text-[#0097b2] sm:text-2xl">{t('turista.pageTitle')}</h1>
      <p className="mb-6 text-center text-sm text-[#001f3f]">{t('subtitleContinue')}</p>

      <div className="rounded-xl bg-gray-100 p-5">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="nomeSocial" className="mb-1 block text-sm font-medium text-[#001f3f]">
              {t('turista.socialName')}
            </label>
            <input
              id="nomeSocial"
              type="text"
              required
              value={nomeSocial}
              onChange={(e) => setNomeSocial(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="nomeUsuario" className="mb-1 block text-sm font-medium text-[#001f3f]">
              {t('turista.username')}
            </label>
            <input
              id="nomeUsuario"
              type="text"
              required
              value={nomeUsuario}
              onChange={(e) => setNomeUsuario(e.target.value)}
              placeholder={t('turista.usernamePlaceholder')}
              className={inputCls}
            />
            <p className="mt-1 text-xs text-[#001f3f]">{usernameFeedback}</p>
          </div>

          <div>
            <label htmlFor="whatsAppTurista" className="mb-1 block text-sm font-medium text-[#001f3f]">
              {t('turista.whatsapp')}
            </label>
            <input
              id="whatsAppTurista"
              type="tel"
              required
              value={whatsApp}
              onChange={(e) => setWhatsApp(e.target.value)}
              className={inputCls}
              autoComplete="tel"
              placeholder={t('turista.whatsappPlaceholder')}
              inputMode="tel"
            />
          </div>

          <div>
            <label htmlFor="emailCadastro" className="mb-1 block text-sm font-medium text-[#001f3f]">
              {t('email')}
            </label>
            {modoLogado ? (
              <p className="w-full rounded-lg bg-gray-200 px-4 py-3 text-sm text-[#001f3f]">{emailSessao || '—'}</p>
            ) : (
              <input
                id="emailCadastro"
                type="email"
                autoComplete="email"
                required
                value={emailSessao}
                onChange={(e) => setEmailSessao(e.target.value.trim().toLowerCase())}
                className={inputCls}
                placeholder={t('email')}
              />
            )}
            {!modoLogado ? (
              <p
                className={`mt-1 text-xs ${
                  emailSessao && !emailValido ? 'text-red-600' : 'text-[#001f3f]/80'
                }`}
              >
                {emailSessao && !emailValido ? t('common.emailInvalid') : t('common.emailHint')}
              </p>
            ) : null}
          </div>

          {!modoLogado ? (
            <>
              <div>
                <label htmlFor="senhaCadastro" className="mb-1 block text-sm font-medium text-[#001f3f]">
                  {t('password')}
                </label>
                <input
                  id="senhaCadastro"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className={inputCls}
                  placeholder={t('signUpPasswordHint')}
                />
              </div>
              <div>
                <label htmlFor="senhaConfirma" className="mb-1 block text-sm font-medium text-[#001f3f]">
                  {t('confirmPassword')}
                </label>
                <input
                  id="senhaConfirma"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={senhaConfirma}
                  onChange={(e) => setSenhaConfirma(e.target.value)}
                  className={inputCls}
                  placeholder={t('signUpPasswordHint')}
                />
              </div>
            </>
          ) : null}

          <label className="flex items-start gap-2 text-sm text-[#001f3f]">
            <input
              type="checkbox"
              checked={aceitePoliticas}
              onChange={(e) => setAceitePoliticas(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300"
            />
            <span>
              {t('profissional.acceptPoliciesIntro')}{' '}
              <Link href="/politicas" className="underline hover:text-[#0097b2]">
                {t('turista.privacy')}
              </Link>{' '}
              {t('profissional.acceptPoliciesAnd')}{' '}
              <Link href="/regras" className="underline hover:text-[#0097b2]">
                {t('turista.terms')}
              </Link>
              .
            </span>
          </label>

          {erroEnvio && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{erroEnvio}</p>}

          <button
            type="submit"
            disabled={enviando || !aceitePoliticas}
            className={`mx-auto block w-full max-w-full rounded-full px-4 py-3.5 text-sm font-bold text-white transition-colors ${
              !aceitePoliticas
                ? 'cursor-not-allowed bg-gray-400'
                : enviando
                  ? 'cursor-wait bg-[#00D443] opacity-80'
                  : 'bg-[#00D443] hover:bg-[#00b838]'
            }`}
          >
            {enviando ? t('sending') : t('submitRegister')}
          </button>
        </form>
      </div>
    </GuiaAuthShell>
  )
}
