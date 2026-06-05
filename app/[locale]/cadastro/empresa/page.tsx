'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { supabase } from '@/lib/supabase'
import GuiaAuthShell from '@/components/GuiaAuthShell'
import { CATEGORIAS_EMPRESA_DB } from '@/lib/segmentosEmpresaGuia'

type CategoriaEmpresa = (typeof CATEGORIAS_EMPRESA_DB)[number]

type UsernameStatus = 'idle' | 'checking' | 'available' | 'unavailable'

type CidadeEmpresa = 'Foz do Iguacu' | 'Ciudad del Este' | 'Puerto Iguazu'

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const usernameRegex = /^[a-z0-9._]{3,20}$/

const categorias: CategoriaEmpresa[] = [...CATEGORIAS_EMPRESA_DB]
const cidades: CidadeEmpresa[] = ['Foz do Iguacu', 'Ciudad del Este', 'Puerto Iguazu']

const senhaRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/

function mapApiEmpresaError(
  code: string | undefined,
  t: (key: string, values?: Record<string, string | number>) => string
): string {
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
      return t('empresa.valPolicies')
    case 'invalid_category':
      return t('apiErrorInvalidCategory')
    default:
      return t('apiErrorDefault')
  }
}

const catMessageKey: Record<CategoriaEmpresa, string> = {
  Restaurantes: 'empresa.cat.Restaurantes',
  Atrativos: 'empresa.cat.Atrativos',
  Lojas: 'empresa.cat.Lojas',
  Hospedagem: 'empresa.cat.Hospedagem',
  'Serviços Locais': 'empresa.cat.ServicosLocais',
}

function catLabel(cat: CategoriaEmpresa, t: (k: string) => string) {
  return t(catMessageKey[cat])
}

function cidadeLabel(cidade: CidadeEmpresa, t: (k: string) => string) {
  switch (cidade) {
    case 'Foz do Iguacu':
      return t('empresa.cidade.fozDoIguacu')
    case 'Ciudad del Este':
      return t('empresa.cidade.ciudadDelEste')
    case 'Puerto Iguazu':
      return t('empresa.cidade.puertoIguazu')
  }
}

export default function CadastroEmpresaPage() {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('Cadastro')
  const tCommon = useTranslations('Common')

  const [nomeFantasia, setNomeFantasia] = useState('')
  const [nomeUsuario, setNomeUsuario] = useState('')
  const [whatsApp, setWhatsApp] = useState('')
  const [emailSessao, setEmailSessao] = useState('')
  const [senha, setSenha] = useState('')
  const [senhaConfirma, setSenhaConfirma] = useState('')
  const [modoLogado, setModoLogado] = useState(false)
  const [categoria, setCategoria] = useState<CategoriaEmpresa>('Restaurantes')
  const [cidade, setCidade] = useState<CidadeEmpresa>('Foz do Iguacu')
  const [enderecoRua, setEnderecoRua] = useState('')
  const [enderecoNumero, setEnderecoNumero] = useState('')
  const [enderecoBairro, setEnderecoBairro] = useState('')
  const [aceitePoliticas, setAceitePoliticas] = useState(false)

  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle')
  const [usernameFeedback, setUsernameFeedback] = useState('')
  const [erroEnvio, setErroEnvio] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [bootOk, setBootOk] = useState(false)

  const usernameLimpo = useMemo(
    () => nomeUsuario.trim().toLowerCase().replace(/^@+/, ''),
    [nomeUsuario]
  )
  const emailValido = useMemo(() => emailRegex.test(emailSessao), [emailSessao])

  useEffect(() => {
    let ativo = true
    const boot = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!ativo) return
      if (session?.user?.id) {
        const uid = session.user.id
        const { data: existente } = await supabase.from('empresas').select('id').eq('usuario_id', uid).maybeSingle()
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
    if (!nomeFantasia.trim()) return t('empresa.valTradeName')
    if (!usernameLimpo || usernameStatus !== 'available') return t('empresa.valUsername')
    if (!whatsApp.trim()) return t('empresa.valWhatsapp')
    if (!emailValido) return t('empresa.valEmail')
    if (!enderecoRua.trim()) return t('empresa.valStreet')
    if (!enderecoNumero.trim()) return t('empresa.valNumber')
    if (!enderecoBairro.trim()) return t('empresa.valNeighborhood')
    if (!aceitePoliticas) return t('empresa.valPolicies')
    if (!modoLogado) {
      if (!senhaRegex.test(senha)) return t('apiErrorInvalidPassword')
      if (senha !== senhaConfirma) return t('signUpPasswordMatch')
    }
    return ''
  }

  const montarEndereco = () => {
    const rua = enderecoRua.trim()
    const numero = enderecoNumero.trim()
    return numero ? `${rua}, ${numero}` : rua
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
        fd.append('nomeFantasia', nomeFantasia.trim())
        fd.append('nomeUsuario', usernameLimpo)
        fd.append('whatsApp', whatsApp.trim())
        fd.append('categoria', categoria)
        fd.append('cidade', cidade)
        fd.append('enderecoRua', enderecoRua.trim())
        fd.append('enderecoNumero', enderecoNumero.trim())
        fd.append('enderecoBairro', enderecoBairro.trim())
        fd.append('aceitePoliticas', String(aceitePoliticas))

        const res = await fetch('/api/cadastro/empresa', { method: 'POST', body: fd })
        const json = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          error?: string
        }
        if (!res.ok) {
          setErroEnvio(mapApiEmpresaError(json.error, t))
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
          role: 'empresa',
          status: 'pre_aprovado',
        },
        { onConflict: 'id' }
      )
      if (upsertUsuario.error) throw new Error(upsertUsuario.error.message)

      const payloadCompleto: Record<string, unknown> = {
        usuario_id: userId,
        nome_fantasia: nomeFantasia.trim(),
        nome_usuario: usernameLimpo,
        categoria,
        cidade,
        endereco: montarEndereco(),
        bairro: enderecoBairro.trim(),
        whatsapp: whatsApp.trim(),
        status: 'aguardando_aprovacao',
      }

      let insertEmpresa = await supabase.from('empresas').insert(payloadCompleto)

      if (
        insertEmpresa.error &&
        insertEmpresa.error.message.toLowerCase().includes('column') &&
        insertEmpresa.error.message.toLowerCase().includes('does not exist')
      ) {
        const payloadMinimo = {
          usuario_id: userId,
          nome_fantasia: nomeFantasia.trim(),
          nome_usuario: usernameLimpo,
          categoria,
          cidade,
          endereco: montarEndereco(),
          status: 'aguardando_aprovacao',
        }
        insertEmpresa = await supabase.from('empresas').insert(payloadMinimo)
      }

      if (insertEmpresa.error && insertEmpresa.error.message.toLowerCase().includes('status')) {
        delete payloadCompleto.status
        insertEmpresa = await supabase.from('empresas').insert(payloadCompleto)
      }

      if (insertEmpresa.error) throw new Error(insertEmpresa.error.message)

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
      <h1 className="mb-2 text-center text-xl font-bold text-[#0097b2] sm:text-2xl">{t('empresa.pageTitle')}</h1>
      <p className="mb-6 text-center text-sm text-[#001f3f]">{t('subtitleContinue')}</p>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="nomeFantasia" className="mb-1 block text-sm font-medium text-[#001f3f]">
            {t('empresa.tradeName')} {t('common.required')}
          </label>
          <input
            id="nomeFantasia"
            type="text"
            required
            value={nomeFantasia}
            onChange={(e) => setNomeFantasia(e.target.value)}
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor="nomeUsuario" className="mb-1 block text-sm font-medium text-[#001f3f]">
            {t('empresa.username')} {t('common.required')}
          </label>
          <input
            id="nomeUsuario"
            type="text"
            required
            value={nomeUsuario}
            onChange={(e) => setNomeUsuario(e.target.value)}
            placeholder={t('empresa.usernamePlaceholder')}
            className={inputCls}
          />
          <p className="mt-1 text-xs text-[#001f3f]">{usernameFeedback}</p>
        </div>

        <div>
          <label htmlFor="whatsAppEmpresa" className="mb-1 block text-sm font-medium text-[#001f3f]">
            {t('empresa.whatsapp')} {t('common.required')}
          </label>
          <input
            id="whatsAppEmpresa"
            type="tel"
            required
            value={whatsApp}
            onChange={(e) => setWhatsApp(e.target.value)}
            className={inputCls}
            autoComplete="tel"
            placeholder={t('empresa.whatsappPlaceholder')}
            inputMode="tel"
          />
        </div>

        <div>
          <label htmlFor="emailEmpresa" className="mb-1 block text-sm font-medium text-[#001f3f]">
            {t('empresa.managerEmail')} {t('common.required')}
          </label>
          {modoLogado ? (
            <p className="w-full rounded-lg bg-gray-200 px-4 py-3 text-sm text-[#001f3f]">{emailSessao || '—'}</p>
          ) : (
            <input
              id="emailEmpresa"
              type="email"
              autoComplete="email"
              required
              value={emailSessao}
              onChange={(e) => setEmailSessao(e.target.value.trim().toLowerCase())}
              className={inputCls}
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
              <label htmlFor="senhaEmpresa" className="mb-1 block text-sm font-medium text-[#001f3f]">
                {t('password')} {t('common.required')}
              </label>
              <input
                id="senhaEmpresa"
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
              <label htmlFor="senhaEmpresaConf" className="mb-1 block text-sm font-medium text-[#001f3f]">
                {t('confirmPassword')} {t('common.required')}
              </label>
              <input
                id="senhaEmpresaConf"
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

        <div>
          <label htmlFor="categoria" className="mb-1 block text-sm font-medium text-[#001f3f]">
            {t('empresa.category')} {t('common.required')}
          </label>
          <select
            id="categoria"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as CategoriaEmpresa)}
            className={inputCls}
          >
            {categorias.map((item) => (
              <option key={item} value={item}>
                {catLabel(item, t)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-3 rounded-lg border border-[#0097b2]/30 bg-white/60 p-3">
          <p className="text-sm font-medium text-[#001f3f]">{t('empresa.addressSection')}</p>
          <div>
            <label htmlFor="enderecoRua" className="mb-1 block text-sm font-medium text-[#001f3f]">
              {t('empresa.street')} {t('common.required')}
            </label>
            <input
              id="enderecoRua"
              type="text"
              required
              value={enderecoRua}
              onChange={(e) => setEnderecoRua(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="enderecoNumero" className="mb-1 block text-sm font-medium text-[#001f3f]">
              {t('empresa.number')} {t('common.required')}
            </label>
            <input
              id="enderecoNumero"
              type="text"
              required
              value={enderecoNumero}
              onChange={(e) => setEnderecoNumero(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="enderecoBairro" className="mb-1 block text-sm font-medium text-[#001f3f]">
              {t('empresa.neighborhood')} {t('common.required')}
            </label>
            <input
              id="enderecoBairro"
              type="text"
              required
              value={enderecoBairro}
              onChange={(e) => setEnderecoBairro(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label htmlFor="cidade" className="mb-1 block text-sm font-medium text-[#001f3f]">
            {t('empresa.cityOrigin')} {t('common.required')}
          </label>
          <select
            id="cidade"
            value={cidade}
            onChange={(e) => setCidade(e.target.value as CidadeEmpresa)}
            className={inputCls}
          >
            {cidades.map((item) => (
              <option key={item} value={item}>
                {cidadeLabel(item, t)}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-start gap-2 text-sm text-[#001f3f]">
          <input
            type="checkbox"
            checked={aceitePoliticas}
            onChange={(e) => setAceitePoliticas(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300"
          />
          <span>{t('empresa.acceptPolicies')}</span>
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
