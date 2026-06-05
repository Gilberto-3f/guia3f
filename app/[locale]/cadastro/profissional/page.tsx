'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/navigation'
import { supabase } from '@/lib/supabase'
import GuiaAuthShell from '@/components/GuiaAuthShell'

type UsernameStatus = 'idle' | 'checking' | 'available' | 'unavailable'

type CategoriaProfissional =
  | 'Guia'
  | 'Taxista'
  | 'Van'
  | 'Motorista de App'
  | 'Anfitriao'

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const usernameRegex = /^[a-z0-9._]{3,20}$/
const categoriasDisponiveis: CategoriaProfissional[] = [
  'Guia',
  'Taxista',
  'Van',
  'Motorista de App',
  'Anfitriao',
]

const senhaRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/

type CidadeProfissional = 'Foz do Iguacu' | 'Ciudad del Este' | 'Puerto Iguazu'

const cidadesProfissional: CidadeProfissional[] = [
  'Foz do Iguacu',
  'Ciudad del Este',
  'Puerto Iguazu',
]

function mapApiProfissionalError(code: string | undefined, t: (key: string) => string): string {
  switch (code) {
    case 'email_exists':
      return t('apiErrorEmailExists')
    case 'invalid_password':
      return t('apiErrorInvalidPassword')
    case 'server_config':
      return t('apiErrorServerConfig')
    case 'username_taken':
      return t('username.unavailable')
    case 'policies':
      return t('profissional.valPolicies')
    case 'auth_database_error':
      return t('apiErrorAuthDatabase')
    case 'invalid_username':
      return t('profissional.valUsername')
    case 'invalid_whatsapp':
      return t('profissional.valWhatsapp')
    case 'invalid_category':
      return t('profissional.valCategory')
    default:
      return t('apiErrorDefault')
  }
}

function labelCategoria(c: CategoriaProfissional, tc: (key: string) => string) {
  switch (c) {
    case 'Guia':
      return tc('profissional.categoria.Guia')
    case 'Taxista':
      return tc('profissional.categoria.Taxista')
    case 'Van':
      return tc('profissional.categoria.Van')
    case 'Motorista de App':
      return tc('profissional.categoria.motoristaApp')
    case 'Anfitriao':
      return tc('profissional.categoria.Anfitriao')
  }
}

type CadastroProfissionalPayload = {
  email: string
  password?: string
  nomeCompleto: string
  nomeUsuario: string
  whatsapp: string
  categoria: string
  cidadeAtuacao: string
  aceitePoliticas: boolean
}

export default function CadastroProfissionalPage() {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('Cadastro')
  const tCommon = useTranslations('Common')

  const [nomeCompleto, setNomeCompleto] = useState('')
  const [nomeUsuario, setNomeUsuario] = useState('')
  const [emailSessao, setEmailSessao] = useState('')
  const [senha, setSenha] = useState('')
  const [senhaConfirma, setSenhaConfirma] = useState('')
  const [modoLogado, setModoLogado] = useState(false)
  const [whatsApp, setWhatsApp] = useState('')
  const [cidadeAtuacao, setCidadeAtuacao] = useState<CidadeProfissional>('Foz do Iguacu')
  const [categoria, setCategoria] = useState<CategoriaProfissional | ''>('')
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
  const placaVermelha = useMemo(
    () => categoria === 'Guia' || categoria === 'Taxista' || categoria === 'Van',
    [categoria]
  )
  const categoriaEscolhida = Boolean(categoria)

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
          .from('profissionais')
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
    if (!nomeCompleto.trim()) return t('profissional.valFullName')
    if (!usernameLimpo || usernameStatus !== 'available') return t('profissional.valUsername')
    if (!whatsApp.trim()) return t('profissional.valWhatsapp')
    if (!emailValido) return t('profissional.valEmail')
    if (!categoria) return t('profissional.valCategory')
    if (!aceitePoliticas) return t('profissional.valPolicies')
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
        const payload: CadastroProfissionalPayload = {
          email: emailSessao.trim().toLowerCase(),
          password: senha,
          nomeCompleto: nomeCompleto.trim(),
          nomeUsuario: usernameLimpo,
          whatsapp: whatsApp.trim(),
          categoria,
          cidadeAtuacao,
          aceitePoliticas,
        }

        const res = await fetch('/api/cadastro/profissional', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          error?: string
        }
        if (!res.ok) {
          setErroEnvio(mapApiProfissionalError(json.error, t))
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
          role: 'profissional',
          status: 'pre_aprovado',
        },
        { onConflict: 'id' }
      )
      if (upsertUsuario.error) throw new Error(upsertUsuario.error.message)

      const payloadProfissional: Record<string, unknown> = {
        usuario_id: userId,
        nome_completo: nomeCompleto.trim(),
        nome_usuario: usernameLimpo,
        telefone: whatsApp.trim(),
        categorias: [categoria],
        placa_vermelha: placaVermelha,
        cidade_atuacao: [cidadeAtuacao],
        status: 'pendente',
      }

      let insertProfissional = await supabase.from('profissionais').insert(payloadProfissional)

      if (insertProfissional.error && insertProfissional.error.message.toLowerCase().includes('telefone')) {
        delete payloadProfissional.telefone
        insertProfissional = await supabase.from('profissionais').insert(payloadProfissional)
      }

      if (insertProfissional.error && insertProfissional.error.message.toLowerCase().includes('cidade_atuacao')) {
        delete payloadProfissional.cidade_atuacao
        insertProfissional = await supabase.from('profissionais').insert(payloadProfissional)
      }

      if (insertProfissional.error && insertProfissional.error.message.toLowerCase().includes('status')) {
        delete payloadProfissional.status
        insertProfissional = await supabase.from('profissionais').insert(payloadProfissional)
      }

      if (insertProfissional.error) throw new Error(insertProfissional.error.message)

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

  return (
    <GuiaAuthShell largeHeaderLogo>
      <h1 className="mb-2 text-center text-xl font-bold text-[#0097b2] sm:text-2xl">{t('profissional.pageTitle')}</h1>
      <p className="mb-2 text-center text-sm text-[#001f3f]">{t('subtitleContinue')}</p>
      <p className="mb-6 text-center text-sm text-[#001f3f]">
        Após o cadastro, envie seus documentos na área logada para verificação. Seu perfil ficará pendente até aprovação do administrador.
      </p>

      <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="nomeCompleto" className="mb-1 block text-sm font-medium text-[#001f3f]">
              {t('profissional.socialName')} {t('common.required')}
            </label>
            <input
              id="nomeCompleto"
              type="text"
              required
              value={nomeCompleto}
              onChange={(e) => setNomeCompleto(e.target.value)}
              className="w-full rounded-lg bg-[#0097b2] text-white placeholder-white/70 px-4 py-3 text-sm outline-none"
            />
          </div>

          <div>
            <label htmlFor="nomeUsuario" className="mb-1 block text-sm font-medium text-[#001f3f]">
              {t('profissional.username')} {t('common.required')}
            </label>
            <input
              id="nomeUsuario"
              type="text"
              required
              value={nomeUsuario}
              onChange={(e) => setNomeUsuario(e.target.value)}
              placeholder={t('profissional.usernamePlaceholder')}
              className="w-full rounded-lg bg-[#0097b2] text-white placeholder-white/70 px-4 py-3 text-sm outline-none"
            />
            <p className="mt-1 text-xs text-[#001f3f]">{usernameFeedback}</p>
          </div>

          <div>
            <label htmlFor="whatsAppProf" className="mb-1 block text-sm font-medium text-[#001f3f]">
              {t('profissional.whatsapp')} {t('common.required')}
            </label>
            <input
              id="whatsAppProf"
              type="tel"
              required
              value={whatsApp}
              onChange={(e) => setWhatsApp(e.target.value)}
              className="w-full rounded-lg bg-[#0097b2] text-white placeholder-white/70 px-4 py-3 text-sm outline-none"
              autoComplete="tel"
              placeholder={t('profissional.whatsappPlaceholder')}
              inputMode="tel"
            />
          </div>

          <div>
            <label htmlFor="emailProf" className="mb-1 block text-sm font-medium text-[#001f3f]">
              {t('email')} {t('common.required')}
            </label>
            {modoLogado ? (
              <p className="w-full rounded-lg bg-gray-200 px-4 py-3 text-sm text-[#001f3f]">{emailSessao || '—'}</p>
            ) : (
              <input
                id="emailProf"
                type="email"
                autoComplete="email"
                required
                value={emailSessao}
                onChange={(e) => setEmailSessao(e.target.value.trim().toLowerCase())}
                className="w-full rounded-lg bg-[#0097b2] text-white placeholder-white/70 px-4 py-3 text-sm outline-none"
                placeholder={t('email')}
              />
            )}
            <p className={`mt-1 text-xs ${emailSessao && !emailValido ? 'text-red-600' : 'text-[#001f3f]'}`}>
              {emailSessao && !emailValido ? t('common.emailInvalid') : t('common.emailHint')}
            </p>
          </div>

          {!modoLogado ? (
            <>
              <div>
                <label htmlFor="senhaProf" className="mb-1 block text-sm font-medium text-[#001f3f]">
                  {t('password')} {t('common.required')}
                </label>
                <input
                  id="senhaProf"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="w-full rounded-lg bg-[#0097b2] text-white placeholder-white/70 px-4 py-3 text-sm outline-none"
                  placeholder={t('signUpPasswordHint')}
                />
              </div>
              <div>
                <label htmlFor="senhaConfProf" className="mb-1 block text-sm font-medium text-[#001f3f]">
                  {t('confirmPassword')} {t('common.required')}
                </label>
                <input
                  id="senhaConfProf"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={senhaConfirma}
                  onChange={(e) => setSenhaConfirma(e.target.value)}
                  className="w-full rounded-lg bg-[#0097b2] text-white placeholder-white/70 px-4 py-3 text-sm outline-none"
                  placeholder={t('signUpPasswordHint')}
                />
              </div>
            </>
          ) : null}

          <div>
            <label htmlFor="cidadeProf" className="mb-1 block text-sm font-medium text-[#001f3f]">
              {t('profissional.cityOrigin')} {t('common.required')}
            </label>
            <select
              id="cidadeProf"
              value={cidadeAtuacao}
              onChange={(e) => setCidadeAtuacao(e.target.value as CidadeProfissional)}
              className="w-full rounded-lg bg-[#0097b2] text-white px-4 py-3 text-sm outline-none"
            >
              {cidadesProfissional.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="categoria" className="mb-1 block text-sm font-medium text-[#001f3f]">
              {t('profissional.category')} {t('common.required')}
            </label>
            <select
              id="categoria"
              required
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as CategoriaProfissional)}
              className="w-full rounded-lg bg-[#0097b2] text-white px-4 py-3 text-sm outline-none"
            >
              <option value="" disabled>
                {t('profissional.categoryPlaceholder')}
              </option>
              {categoriasDisponiveis.map((item) => (
                <option key={item} value={item}>
                  {labelCategoria(item, t)}
                </option>
              ))}
            </select>
          </div>

          {categoriaEscolhida ? (
            <div className="rounded-lg border border-[#0097b2] bg-white px-3 py-2 text-sm text-[#001f3f]">
              <span className="font-medium">{t('profissional.redPlate')}</span>{' '}
              <span className={placaVermelha ? 'font-semibold text-[#00D443]' : 'font-semibold text-[#0097b2]'}>
                {placaVermelha ? t('profissional.redPlateYes') : t('profissional.redPlateNo')}
              </span>
            </div>
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
    </GuiaAuthShell>
  )
}
