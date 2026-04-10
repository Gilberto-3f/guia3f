'use client'

import Link from 'next/link'
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { supabase } from '@/lib/supabase'
import { garantirMagicLinkEnviado } from '@/lib/magicLinkCadastroCliente'
import GuiaAuthShell from '@/components/GuiaAuthShell'

type UsernameStatus = 'idle' | 'checking' | 'available' | 'unavailable'

type CategoriaEmpresa =
  | 'Restaurantes'
  | 'Atrativos'
  | 'Lojas'
  | 'Hospedagem'
  | 'Compras Paraguai'

type CidadeEmpresa = 'Foz do Iguacu' | 'Ciudad del Este' | 'Puerto Iguazu'

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const usernameRegex = /^[a-z0-9._]{3,20}$/
const minimoFotos = 3
const maxDescricao = 170

const categorias: CategoriaEmpresa[] = [
  'Restaurantes',
  'Atrativos',
  'Lojas',
  'Hospedagem',
  'Compras Paraguai',
]
const cidades: CidadeEmpresa[] = ['Foz do Iguacu', 'Ciudad del Este', 'Puerto Iguazu']
const diasSemana = ['Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado', 'Domingo']

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
    case 'photos_min':
      return t('empresa.valPhotos', { min: minimoFotos })
    case 'doc_required':
      return t('empresa.valDoc')
    case 'policies':
      return t('empresa.valPolicies')
    default:
      return t('apiErrorDefault')
  }
}

const catMessageKey: Record<CategoriaEmpresa, string> = {
  Restaurantes: 'empresa.cat.Restaurantes',
  Atrativos: 'empresa.cat.Atrativos',
  Lojas: 'empresa.cat.Lojas',
  Hospedagem: 'empresa.cat.Hospedagem',
  'Compras Paraguai': 'empresa.cat.comprasParaguai',
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
  const [emailSessao, setEmailSessao] = useState('')
  const [senha, setSenha] = useState('')
  const [senhaConfirma, setSenhaConfirma] = useState('')
  const [modoLogado, setModoLogado] = useState(false)
  const [categoria, setCategoria] = useState<CategoriaEmpresa>('Restaurantes')
  const [cidade, setCidade] = useState<CidadeEmpresa>('Foz do Iguacu')
  const [enderecoCompleto, setEnderecoCompleto] = useState('')
  const [telefone, setTelefone] = useState('')
  const [whatsApp, setWhatsApp] = useState('')
  const [website, setWebsite] = useState('')
  const [descricaoCurta, setDescricaoCurta] = useState('')
  const [horariosSelecionados, setHorariosSelecionados] = useState<string[]>([])
  const [aceitePoliticas, setAceitePoliticas] = useState(false)

  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState('')
  const [fotosFiles, setFotosFiles] = useState<File[]>([])
  const [fotosPreview, setFotosPreview] = useState<string[]>([])
  const [documentoComercialFile, setDocumentoComercialFile] = useState<File | null>(null)

  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle')
  const [usernameFeedback, setUsernameFeedback] = useState('')
  const [erroEnvio, setErroEnvio] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [bootOk, setBootOk] = useState(false)
  const [magicLinkEnviado, setMagicLinkEnviado] = useState(false)

  const usernameLimpo = useMemo(
    () => nomeUsuario.trim().toLowerCase().replace(/^@+/, ''),
    [nomeUsuario]
  )
  const emailValido = useMemo(() => emailRegex.test(emailSessao), [emailSessao])
  const descricaoValida = useMemo(
    () => descricaoCurta.trim().length > 0 && descricaoCurta.length <= maxDescricao,
    [descricaoCurta]
  )
  const totalFotos = fotosFiles.length

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
    if (!logoFile) {
      setLogoPreview('')
      return
    }

    const objectUrl = URL.createObjectURL(logoFile)
    setLogoPreview(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [logoFile])

  useEffect(() => {
    if (fotosFiles.length === 0) {
      setFotosPreview([])
      return
    }

    const urls = fotosFiles.map((file) => URL.createObjectURL(file))
    setFotosPreview(urls)

    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [fotosFiles])

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

  const onSingleFileChange = (
    event: ChangeEvent<HTMLInputElement>,
    setter: (file: File | null) => void
  ) => {
    setter(event.target.files?.[0] ?? null)
  }

  const onFotosChange = (event: ChangeEvent<HTMLInputElement>) => {
    const arquivos = event.target.files ? Array.from(event.target.files) : []
    setFotosFiles(arquivos)
  }

  const toggleDia = (dia: string) => {
    setHorariosSelecionados((prev) =>
      prev.includes(dia) ? prev.filter((item) => item !== dia) : [...prev, dia]
    )
  }

  const geocodificarEndereco = async (_endereco: string) => {
    return { status: 'pendente', latitude: null, longitude: null }
  }

  const uploadArquivo = async (
    bucket: 'empresas' | 'documentos',
    folder: string,
    userId: string,
    file: File
  ) => {
    const ext = file.name.split('.').pop() || 'bin'
    const path = `${folder}/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })

    if (error) throw new Error(error.message)

    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    return data.publicUrl
  }

  const validarFormulario = () => {
    if (!nomeFantasia.trim()) return t('empresa.valTradeName')
    if (!usernameLimpo || usernameStatus !== 'available') return t('empresa.valUsername')
    if (!emailValido) return t('empresa.valEmail')
    if (!enderecoCompleto.trim()) return t('empresa.valAddress')
    if (!telefone.trim()) return t('empresa.valPhone')
    if (!whatsApp.trim()) return t('empresa.valWhatsapp')
    if (!descricaoValida) return t('empresa.valDescription', { max: maxDescricao })
    if (totalFotos < minimoFotos) return t('empresa.valPhotos', { min: minimoFotos })
    if (!documentoComercialFile) return t('empresa.valDoc')
    if (!aceitePoliticas) return t('empresa.valPolicies')
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
      if (!documentoComercialFile) return
      try {
        setEnviando(true)
        const fd = new FormData()
        fd.append('email', emailSessao.trim().toLowerCase())
        fd.append('password', senha)
        fd.append('nomeFantasia', nomeFantasia.trim())
        fd.append('nomeUsuario', usernameLimpo)
        fd.append('categoria', categoria)
        fd.append('cidade', cidade)
        fd.append('enderecoCompleto', enderecoCompleto.trim())
        fd.append('telefone', telefone.trim())
        fd.append('whatsApp', whatsApp.trim())
        fd.append('descricaoCurta', descricaoCurta.trim())
        fd.append('horarios', JSON.stringify(horariosSelecionados))
        fd.append('aceitePoliticas', String(aceitePoliticas))
        if (website.trim()) fd.append('website', website.trim())
        if (logoFile) fd.append('logo', logoFile)
        fotosFiles.forEach((f) => fd.append('fotos', f))
        fd.append('documentoComercial', documentoComercialFile)
        fd.append('redirectOrigin', typeof window !== 'undefined' ? window.location.origin : '')

        const res = await fetch('/api/cadastro/empresa', { method: 'POST', body: fd })
        const json = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          error?: string
          magicLinkSent?: boolean
        }
        if (!res.ok) {
          setErroEnvio(mapApiEmpresaError(json.error, t))
          return
        }
        if (json.magicLinkSent !== true) {
          const linkOk = await garantirMagicLinkEnviado(emailSessao)
          if (!linkOk) {
            setErroEnvio(t('magicLinkSendError'))
            return
          }
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
          role: 'empresa',
          status: 'pre_aprovado',
        },
        { onConflict: 'id' }
      )
      if (upsertUsuario.error) throw new Error(upsertUsuario.error.message)

      const [logoUrl, fotosUrls, documentoComercialUrl, geo] = await Promise.all([
        logoFile ? uploadArquivo('empresas', 'logos', userId, logoFile) : Promise.resolve(null),
        Promise.all(
          fotosFiles.map((file) => uploadArquivo('empresas', 'fotos', userId, file))
        ),
        uploadArquivo('documentos', 'empresa-documentos', userId, documentoComercialFile as File),
        geocodificarEndereco(enderecoCompleto),
      ])

      const payloadCompleto: Record<string, unknown> = {
        usuario_id: userId,
        nome_fantasia: nomeFantasia.trim(),
        nome_usuario: usernameLimpo,
        categoria,
        cidade,
        endereco: enderecoCompleto.trim(),
        telefone: telefone.trim(),
        whatsapp: whatsApp.trim(),
        descricao_curta: descricaoCurta.trim(),
        horarios_funcionamento: horariosSelecionados,
        fotos_urls: fotosUrls,
        documento_comercial_url: documentoComercialUrl,
        geocoding_status: geo.status,
        latitude: geo.latitude,
        longitude: geo.longitude,
        status: 'aguardando_aprovacao',
      }

      if (logoUrl) {
        payloadCompleto.logo_url = logoUrl
      }
      if (website.trim()) {
        payloadCompleto.website = website.trim()
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
          endereco: enderecoCompleto.trim(),
          descricao_curta: descricaoCurta.trim(),
          status: 'aguardando_aprovacao',
        }
        insertEmpresa = await supabase.from('empresas').insert(payloadMinimo)
      }

      if (insertEmpresa.error && insertEmpresa.error.message.toLowerCase().includes('status')) {
        delete payloadCompleto.status
        insertEmpresa = await supabase.from('empresas').insert(payloadCompleto)
      }

      if (insertEmpresa.error && insertEmpresa.error.message.toLowerCase().includes('website')) {
        delete payloadCompleto.website
        insertEmpresa = await supabase.from('empresas').insert(payloadCompleto)
      }

      if (insertEmpresa.error) throw new Error(insertEmpresa.error.message)

      const linkOk = await garantirMagicLinkEnviado(emailUser)
      if (!linkOk) {
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
      <h1 className="mb-2 text-center text-xl font-bold text-[#0097b2] sm:text-2xl">{t('empresa.pageTitle')}</h1>
      <p className="mb-6 text-center text-sm text-[#001f3f]">{t('subtitleContinue')}</p>

      <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="logo" className="mb-1 block text-sm font-medium text-[#001f3f]">
              {t('empresa.logo')} {t('common.optional')}
            </label>
            <input
              id="logo"
              type="file"
              accept="image/*"
              onChange={(e) => onSingleFileChange(e, setLogoFile)}
              className="block w-full rounded-lg bg-[#0097b2] text-white file:mr-3 file:rounded-md file:border-0 file:bg-white/20 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white px-3 py-2 text-sm"
            />
            {logoPreview && (
              <img
                src={logoPreview}
                alt={t('empresa.previewLogo')}
                className="mt-3 h-24 w-24 rounded-lg border border-gray-200 object-cover"
              />
            )}
          </div>

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
              className="w-full rounded-lg bg-[#0097b2] text-white placeholder-white/70 px-4 py-3 text-sm outline-none"
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
              className="w-full rounded-lg bg-[#0097b2] text-white placeholder-white/70 px-4 py-3 text-sm outline-none"
            />
            <p className="mt-1 text-xs text-[#001f3f]">{usernameFeedback}</p>
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
                  className="w-full rounded-lg bg-[#0097b2] text-white placeholder-white/70 px-4 py-3 text-sm outline-none"
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
                  className="w-full rounded-lg bg-[#0097b2] text-white placeholder-white/70 px-4 py-3 text-sm outline-none"
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
              className="w-full rounded-lg bg-[#0097b2] text-white px-4 py-3 text-sm outline-none"
            >
              {categorias.map((item) => (
                <option key={item} value={item}>
                  {catLabel(item, t)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="cidade" className="mb-1 block text-sm font-medium text-[#001f3f]">
              {t('empresa.city')} {t('common.required')}
            </label>
            <select
              id="cidade"
              value={cidade}
              onChange={(e) => setCidade(e.target.value as CidadeEmpresa)}
              className="w-full rounded-lg bg-[#0097b2] text-white px-4 py-3 text-sm outline-none"
            >
              {cidades.map((item) => (
                <option key={item} value={item}>
                  {cidadeLabel(item, t)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="enderecoCompleto" className="mb-1 block text-sm font-medium text-[#001f3f]">
              {t('empresa.fullAddress')} {t('common.required')}
            </label>
            <input
              id="enderecoCompleto"
              type="text"
              required
              value={enderecoCompleto}
              onChange={(e) => setEnderecoCompleto(e.target.value)}
              className="w-full rounded-lg bg-[#0097b2] text-white placeholder-white/70 px-4 py-3 text-sm outline-none"
            />
          </div>

          <div>
            <label htmlFor="telefone" className="mb-1 block text-sm font-medium text-[#001f3f]">
              {t('empresa.phone')} {t('common.required')}
            </label>
            <input
              id="telefone"
              type="tel"
              required
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              className="w-full rounded-lg bg-[#0097b2] text-white placeholder-white/70 px-4 py-3 text-sm outline-none"
            />
          </div>

          <div>
            <label htmlFor="whatsApp" className="mb-1 block text-sm font-medium text-[#001f3f]">
              {t('empresa.whatsapp')} {t('common.required')}
            </label>
            <input
              id="whatsApp"
              type="tel"
              required
              value={whatsApp}
              onChange={(e) => setWhatsApp(e.target.value)}
              className="w-full rounded-lg bg-[#0097b2] text-white placeholder-white/70 px-4 py-3 text-sm outline-none"
            />
          </div>

          <div>
            <label htmlFor="websiteEmpresa" className="mb-1 block text-sm font-medium text-[#001f3f]">
              {t('empresa.website')}
            </label>
            <input
              id="websiteEmpresa"
              type="url"
              inputMode="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="w-full rounded-lg bg-[#0097b2] text-white placeholder-white/70 px-4 py-3 text-sm outline-none"
              placeholder={t('empresa.websitePlaceholder')}
            />
          </div>

          <div>
            <label htmlFor="descricaoCurta" className="mb-1 block text-sm font-medium text-[#001f3f]">
              {t('empresa.shortDescription', { count: descricaoCurta.length, max: maxDescricao })}{' '}
              {t('common.required')}
            </label>
            <textarea
              id="descricaoCurta"
              required
              maxLength={maxDescricao}
              value={descricaoCurta}
              onChange={(e) => setDescricaoCurta(e.target.value)}
              rows={3}
              className="w-full rounded-lg bg-[#0097b2] text-white placeholder-white/70 px-4 py-3 text-sm outline-none"
            />
          </div>

          <fieldset>
            <legend className="mb-2 block text-sm font-medium text-[#001f3f]">
              {t('empresa.openingHours')} {t('common.required')}
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {diasSemana.map((dia) => (
                <label
                  key={dia}
                  className="flex items-center gap-2 rounded-lg border border-[#0097b2] p-2 text-sm text-[#001f3f]"
                >
                  <input
                    type="checkbox"
                    checked={horariosSelecionados.includes(dia)}
                    onChange={() => toggleDia(dia)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span>{t(`empresa.weekday.${dia}`)}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="fotosEmpresa" className="mb-1 block text-sm font-medium text-[#001f3f]">
              {t('empresa.companyPhotos')} {t('common.required')}
            </label>
            <input
              id="fotosEmpresa"
              type="file"
              accept="image/*"
              multiple
              onChange={onFotosChange}
              className="block w-full rounded-lg bg-[#0097b2] text-white file:mr-3 file:rounded-md file:border-0 file:bg-white/20 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white px-3 py-2 text-sm"
            />
            <p className={`mt-1 text-xs ${totalFotos < minimoFotos ? 'text-red-600' : 'text-green-600'}`}>
              {t('empresa.photosCount', { count: totalFotos, min: minimoFotos })}
            </p>
            {totalFotos < minimoFotos && (
              <p className="mt-1 text-xs text-red-600">{t('empresa.photosNeedMore')}</p>
            )}
            {fotosPreview.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {fotosPreview.map((url, index) => (
                  <img
                    key={`${url}-${index}`}
                    src={url}
                    alt={t('empresa.previewPhoto', { n: index + 1 })}
                    className="h-20 w-full rounded-lg border border-gray-200 object-cover"
                  />
                ))}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="documentoComercial" className="mb-1 block text-sm font-medium text-[#001f3f]">
              {t('empresa.commercialDoc')} {t('common.required')}
            </label>
            <input
              id="documentoComercial"
              type="file"
              accept="image/*,.pdf"
              required
              onChange={(e) => onSingleFileChange(e, setDocumentoComercialFile)}
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
