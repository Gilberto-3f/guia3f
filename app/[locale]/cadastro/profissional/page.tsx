'use client'

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { supabase } from '@/lib/supabase'
import { sendPostCadastroMagicLink } from '@/lib/sendPostCadastroMagicLink'
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

type PaisProfissional = 'Brasil' | 'Paraguai' | 'Argentina'
type CidadeProfissional = 'Foz do Iguacu' | 'Ciudad del Este' | 'Puerto Iguazu'

const paisesProfissional: PaisProfissional[] = ['Brasil', 'Paraguai', 'Argentina']
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
    case 'id_docs_required':
    case 'address_proof_required':
    case 'profession_proof_required':
      return t('profissional.valDocs')
    case 'policies':
      return t('profissional.valPolicies')
    case 'invalid_username':
      return t('profissional.valUsername')
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
  const [pais, setPais] = useState<PaisProfissional>('Brasil')
  const [cidadeAtuacao, setCidadeAtuacao] = useState<CidadeProfissional>('Foz do Iguacu')
  const [categoria, setCategoria] = useState<CategoriaProfissional>('Guia')
  const [aceitePoliticas, setAceitePoliticas] = useState(false)

  const [fotoPerfilFile, setFotoPerfilFile] = useState<File | null>(null)
  const [fotoPerfilPreview, setFotoPerfilPreview] = useState('')
  const [identidadeFrenteFile, setIdentidadeFrenteFile] = useState<File | null>(null)
  const [identidadeVersoFile, setIdentidadeVersoFile] = useState<File | null>(null)
  const [comprovanteResidenciaFile, setComprovanteResidenciaFile] = useState<File | null>(null)
  const [comprovanteProfissaoFile, setComprovanteProfissaoFile] = useState<File | null>(null)

  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle')
  const [usernameFeedback, setUsernameFeedback] = useState('')
  const [erroEnvio, setErroEnvio] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [bootOk, setBootOk] = useState(false)
  const [magicLinkEnviado, setMagicLinkEnviado] = useState(false)

  const emailValido = useMemo(() => emailRegex.test(emailSessao), [emailSessao])
  const usernameLimpo = useMemo(
    () => nomeUsuario.trim().toLowerCase().replace(/^@+/, ''),
    [nomeUsuario]
  )
  const placaVermelha = useMemo(
    () => categoria === 'Guia' || categoria === 'Taxista' || categoria === 'Van',
    [categoria]
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
    if (!fotoPerfilFile) {
      setFotoPerfilPreview('')
      return
    }

    const objectUrl = URL.createObjectURL(fotoPerfilFile)
    setFotoPerfilPreview(objectUrl)

    return () => URL.revokeObjectURL(objectUrl)
  }, [fotoPerfilFile])

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

  const onFileChange = (
    event: ChangeEvent<HTMLInputElement>,
    setter: (file: File | null) => void
  ) => {
    const file = event.target.files?.[0] ?? null
    setter(file)
  }

  const uploadArquivo = async (
    file: File,
    folder: 'foto-perfil' | 'documentos',
    userId: string
  ) => {
    const ext = file.name.split('.').pop() || 'bin'
    const path = `${folder}/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from('documentos').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })

    if (error) throw new Error(error.message)

    const { data } = supabase.storage.from('documentos').getPublicUrl(path)
    return data.publicUrl
  }

  const validarFormulario = () => {
    if (!nomeCompleto.trim()) return t('profissional.valFullName')
    if (!usernameLimpo || usernameStatus !== 'available') return t('profissional.valUsername')
    if (!emailValido) return t('profissional.valEmail')
    if (
      !identidadeFrenteFile ||
      !identidadeVersoFile ||
      !comprovanteResidenciaFile ||
      !comprovanteProfissaoFile
    ) {
      return t('profissional.valDocs')
    }
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
      if (
        !identidadeFrenteFile ||
        !identidadeVersoFile ||
        !comprovanteResidenciaFile ||
        !comprovanteProfissaoFile
      ) {
        return
      }
      try {
        setEnviando(true)
        const fd = new FormData()
        fd.append('email', emailSessao.trim().toLowerCase())
        fd.append('password', senha)
        fd.append('nomeCompleto', nomeCompleto.trim())
        fd.append('nomeUsuario', usernameLimpo)
        fd.append('categoria', categoria)
        fd.append('pais', pais)
        fd.append('cidadeAtuacao', cidadeAtuacao)
        fd.append('aceitePoliticas', String(aceitePoliticas))
        fd.append('identidadeFrente', identidadeFrenteFile)
        fd.append('identidadeVerso', identidadeVersoFile)
        fd.append('comprovanteResidencia', comprovanteResidenciaFile)
        fd.append('comprovanteProfissao', comprovanteProfissaoFile)
        if (fotoPerfilFile) fd.append('fotoPerfil', fotoPerfilFile)

        const res = await fetch('/api/cadastro/profissional', { method: 'POST', body: fd })
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
        if (!res.ok) {
          setErroEnvio(mapApiProfissionalError(json.error, t))
          return
        }
        const { error: otpError } = await sendPostCadastroMagicLink(emailSessao)
        if (otpError) {
          setErroEnvio(t('magicLinkSendError'))
          return
        }
        setMagicLinkEnviado(true)
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

      const identidadeUrl = await uploadArquivo(identidadeFrenteFile as File, 'documentos', userId)
      const documentoVersoUrl = await uploadArquivo(identidadeVersoFile as File, 'documentos', userId)
      const comprovanteResidenciaUrl = await uploadArquivo(
        comprovanteResidenciaFile as File,
        'documentos',
        userId
      )
      const comprovanteProfissaoUrl = await uploadArquivo(
        comprovanteProfissaoFile as File,
        'documentos',
        userId
      )
      const fotoPerfilUrl = fotoPerfilFile
        ? await uploadArquivo(fotoPerfilFile, 'foto-perfil', userId)
        : null

      const payloadProfissional: Record<string, unknown> = {
        usuario_id: userId,
        nome_completo: nomeCompleto.trim(),
        nome_usuario: usernameLimpo,
        categorias: [categoria],
        placa_vermelha: placaVermelha,
        identidade_url: identidadeUrl,
        documento_verso_url: documentoVersoUrl,
        comprovante_residencia_url: comprovanteResidenciaUrl,
        comprovante_profissao_url: comprovanteProfissaoUrl,
        pais,
        cidade_atuacao: [cidadeAtuacao],
        status: 'pendente',
      }

      if (fotoPerfilUrl) {
        payloadProfissional.foto_perfil_url = fotoPerfilUrl
      }

      let insertProfissional = await supabase.from('profissionais').insert(payloadProfissional)

      if (insertProfissional.error && payloadProfissional.foto_perfil_url) {
        const mensagemErro = insertProfissional.error.message.toLowerCase()
        if (mensagemErro.includes('foto_perfil_url')) {
          delete payloadProfissional.foto_perfil_url
          insertProfissional = await supabase.from('profissionais').insert(payloadProfissional)
        }
      }

      if (
        insertProfissional.error &&
        insertProfissional.error.message.toLowerCase().includes('documento_verso')
      ) {
        delete payloadProfissional.documento_verso_url
        insertProfissional = await supabase.from('profissionais').insert(payloadProfissional)
      }

      if (insertProfissional.error && insertProfissional.error.message.toLowerCase().includes('pais')) {
        delete payloadProfissional.pais
        delete payloadProfissional.cidade_atuacao
        insertProfissional = await supabase.from('profissionais').insert(payloadProfissional)
      }

      if (insertProfissional.error && insertProfissional.error.message.toLowerCase().includes('status')) {
        delete payloadProfissional.status
        insertProfissional = await supabase.from('profissionais').insert(payloadProfissional)
      }

      if (insertProfissional.error) throw new Error(insertProfissional.error.message)

      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: emailUser,
        options: {
          emailRedirectTo: `${origin}/auth/callback`,
          shouldCreateUser: false,
        },
      })
      if (otpError) {
        setErroEnvio(t('magicLinkSendError'))
        return
      }
      await supabase.auth.signOut()
      setMagicLinkEnviado(true)
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

  if (magicLinkEnviado) {
    return (
      <GuiaAuthShell largeHeaderLogo>
        <h1 className="mb-4 text-center text-xl font-bold text-[#0097b2]">{t('magicLinkSentTitle')}</h1>
        <p className="mx-auto mb-3 max-w-md text-center text-sm leading-relaxed text-[#001f3f]">
          {t('magicLinkSentBody')}
        </p>
        <p className="mx-auto max-w-md text-center text-xs text-[#001f3f]/80">{t('magicLinkSentHint')}</p>
        <div className="mt-8 text-center text-sm text-[#001f3f]">
          <Link href="/login" className="font-medium text-[#0097b2] hover:underline">
            {t('magicLinkGoToLogin')}
          </Link>
        </div>
      </GuiaAuthShell>
    )
  }

  return (
    <GuiaAuthShell largeHeaderLogo>
      <h1 className="mb-2 text-center text-xl font-bold text-[#0097b2] sm:text-2xl">{t('profissional.pageTitle')}</h1>
      <p className="mb-6 text-center text-sm text-[#001f3f]">{t('subtitleContinue')}</p>

      <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="fotoPerfil" className="mb-1 block text-sm font-medium text-[#001f3f]">
              {t('profissional.profilePhoto')} {t('common.optional')}
            </label>
            <input
              id="fotoPerfil"
              type="file"
              accept="image/*"
              onChange={(e) => onFileChange(e, setFotoPerfilFile)}
              className="block w-full rounded-lg bg-[#0097b2] text-white file:mr-3 file:rounded-md file:border-0 file:bg-white/20 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white px-3 py-2 text-sm"
            />
            {fotoPerfilPreview && (
              <img
                src={fotoPerfilPreview}
                alt={t('profissional.previewProfilePhoto')}
                className="mt-3 h-24 w-24 rounded-full border border-gray-200 object-cover"
              />
            )}
          </div>

          <div>
            <label htmlFor="nomeCompleto" className="mb-1 block text-sm font-medium text-[#001f3f]">
              {t('profissional.fullName')} {t('common.required')}
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
            <label htmlFor="paisProf" className="mb-1 block text-sm font-medium text-[#001f3f]">
              {t('profissional.countryWork')} {t('common.required')}
            </label>
            <select
              id="paisProf"
              value={pais}
              onChange={(e) => setPais(e.target.value as PaisProfissional)}
              className="w-full rounded-lg bg-[#0097b2] text-white px-4 py-3 text-sm outline-none"
            >
              {paisesProfissional.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="cidadeProf" className="mb-1 block text-sm font-medium text-[#001f3f]">
              {t('profissional.cityWork')} {t('common.required')}
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
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as CategoriaProfissional)}
              className="w-full rounded-lg bg-[#0097b2] text-white px-4 py-3 text-sm outline-none"
            >
              {categoriasDisponiveis.map((item) => (
                <option key={item} value={item}>
                  {labelCategoria(item, t)}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-lg bg-white border border-[#0097b2] px-3 py-2 text-sm text-[#001f3f]">
            <span className="font-medium">{t('profissional.redPlate')}</span>{' '}
            {placaVermelha ? t('profissional.redPlateYes') : t('profissional.redPlateNo')}
          </div>

          <div>
            <label htmlFor="identidadeFrente" className="mb-1 block text-sm font-medium text-[#001f3f]">
              {t('profissional.idDocument')} {t('common.required')}
            </label>
            <input
              id="identidadeFrente"
              type="file"
              accept="image/*,.pdf"
              required
              onChange={(e) => onFileChange(e, setIdentidadeFrenteFile)}
              className="block w-full rounded-lg bg-[#0097b2] text-white file:mr-3 file:rounded-md file:border-0 file:bg-white/20 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="identidadeVerso" className="mb-1 block text-sm font-medium text-[#001f3f]">
              {t('profissional.idDocumentBack')} {t('common.required')}
            </label>
            <input
              id="identidadeVerso"
              type="file"
              accept="image/*,.pdf"
              required
              onChange={(e) => onFileChange(e, setIdentidadeVersoFile)}
              className="block w-full rounded-lg bg-[#0097b2] text-white file:mr-3 file:rounded-md file:border-0 file:bg-white/20 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="comprovanteResidencia" className="mb-1 block text-sm font-medium text-[#001f3f]">
              {t('profissional.addressProof')} {t('common.required')}
            </label>
            <input
              id="comprovanteResidencia"
              type="file"
              accept="image/*,.pdf"
              required
              onChange={(e) => onFileChange(e, setComprovanteResidenciaFile)}
              className="block w-full rounded-lg bg-[#0097b2] text-white file:mr-3 file:rounded-md file:border-0 file:bg-white/20 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="comprovanteProfissao" className="mb-1 block text-sm font-medium text-[#001f3f]">
              {t('profissional.professionProof')} {t('common.required')}
            </label>
            <input
              id="comprovanteProfissao"
              type="file"
              accept="image/*,.pdf"
              required
              onChange={(e) => onFileChange(e, setComprovanteProfissaoFile)}
              className="block w-full rounded-lg bg-[#0097b2] text-white file:mr-3 file:rounded-md file:border-0 file:bg-white/20 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white px-3 py-2 text-sm"
            />
          </div>

          <label className="flex items-start gap-2 text-sm text-[#001f3f]">
            <input
              type="checkbox"
              checked={aceitePoliticas}
              onChange={(e) => setAceitePoliticas(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300"
            />
            <span>{t('profissional.acceptPolicies')}</span>
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
