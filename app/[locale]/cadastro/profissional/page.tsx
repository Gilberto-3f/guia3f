'use client'

import Image from 'next/image'
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type UsernameStatus = 'idle' | 'checking' | 'available' | 'unavailable'

type CategoriaProfissional =
  | 'Guia'
  | 'Taxista'
  | 'Van'
  | 'Motorista de App'
  | 'Anfitriao'

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const usernameRegex = /^[a-z0-9._]{3,20}$/
const senhaMinima = 8

const VERDE = '#00D443'
const categoriasDisponiveis: CategoriaProfissional[] = [
  'Guia',
  'Taxista',
  'Van',
  'Motorista de App',
  'Anfitriao',
]

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

  const [nomeCompleto, setNomeCompleto] = useState('')
  const [nomeUsuario, setNomeUsuario] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [categoria, setCategoria] = useState<CategoriaProfissional>('Guia')
  const [aceitePoliticas, setAceitePoliticas] = useState(false)

  const [fotoPerfilFile, setFotoPerfilFile] = useState<File | null>(null)
  const [fotoPerfilPreview, setFotoPerfilPreview] = useState('')
  const [identidadeFile, setIdentidadeFile] = useState<File | null>(null)
  const [comprovanteResidenciaFile, setComprovanteResidenciaFile] = useState<File | null>(null)
  const [comprovanteProfissaoFile, setComprovanteProfissaoFile] = useState<File | null>(null)

  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle')
  const [usernameFeedback, setUsernameFeedback] = useState('')
  const [erroEnvio, setErroEnvio] = useState('')
  const [enviando, setEnviando] = useState(false)

  const emailValido = useMemo(() => emailRegex.test(email), [email])
  const senhaValida = useMemo(() => senha.length >= senhaMinima, [senha])
  const usernameLimpo = useMemo(
    () => nomeUsuario.trim().toLowerCase().replace(/^@+/, ''),
    [nomeUsuario]
  )
  const placaVermelha = useMemo(
    () => categoria === 'Guia' || categoria === 'Taxista' || categoria === 'Van',
    [categoria]
  )

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
  }, [usernameLimpo, locale, t])

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
    if (!senhaValida) return t('profissional.valPassword', { min: senhaMinima })
    if (!identidadeFile || !comprovanteResidenciaFile || !comprovanteProfissaoFile) {
      return t('profissional.valDocs')
    }
    if (!aceitePoliticas) return t('profissional.valPolicies')
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

    try {
      setEnviando(true)

      const authResp = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: senha,
        options: {
          emailRedirectTo: `${window.location.origin}/confirmar-email`,
        },
      })

      if (authResp.error) throw new Error(authResp.error.message)

      const userId = authResp.data.user?.id
      if (!userId) throw new Error(t('authUserError'))

      const identidadeUrl = await uploadArquivo(identidadeFile as File, 'documentos', userId)
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
        comprovante_residencia_url: comprovanteResidenciaUrl,
        comprovante_profissao_url: comprovanteProfissaoUrl,
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

      if (insertProfissional.error) throw new Error(insertProfissional.error.message)

      const upsertUsuario = await supabase.from('usuarios').upsert(
        {
          id: userId,
          email: email.trim().toLowerCase(),
          role: 'profissional',
        },
        { onConflict: 'id' }
      )

      if (upsertUsuario.error) throw new Error(upsertUsuario.error.message)

      router.push(`/confirmar-email?email=${encodeURIComponent(email.trim().toLowerCase())}`)
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : t('unexpectedError')
      setErroEnvio(mensagem)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#0097b2] flex items-center justify-center p-4">
      <section className="bg-white rounded-2xl border-2 border-[#0097b2] p-8 w-full max-w-md shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1)]">
        <div className="flex justify-center mb-6">
          <Image src="/logo.png" width={150} height={50} alt="Guia 3F" priority />
        </div>
        <h1 className="text-2xl font-bold text-[#0097b2] text-center">{t('profissional.pageTitle')}</h1>
        <p className="mt-2 text-sm text-[#001f3f] text-center">{t('profissional.subtitle')}</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
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
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-[#001f3f]">
              {t('email')} {t('common.required')}
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-[#0097b2] text-white placeholder-white/70 px-4 py-3 text-sm outline-none"
            />
            <p className={`mt-1 text-xs ${email && !emailValido ? 'text-red-600' : 'text-[#001f3f]'}`}>
              {email && !emailValido ? t('common.emailInvalid') : t('common.emailHint')}
            </p>
          </div>

          <div>
            <label htmlFor="senha" className="mb-1 block text-sm font-medium text-[#001f3f]">
              {t('password')} {t('common.required')}
            </label>
            <input
              id="senha"
              type="password"
              required
              minLength={senhaMinima}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full rounded-lg bg-[#0097b2] text-white placeholder-white/70 px-4 py-3 text-sm outline-none"
            />
            <p className={`mt-1 text-xs ${senha && !senhaValida ? 'text-red-600' : 'text-[#001f3f]'}`}>
              {senha && !senhaValida
                ? t('profissional.passwordShort', { min: senhaMinima })
                : t('profissional.passwordOk', { min: senhaMinima })}
            </p>
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
            <label htmlFor="identidade" className="mb-1 block text-sm font-medium text-[#001f3f]">
              {t('profissional.idDocument')} {t('common.required')}
            </label>
            <input
              id="identidade"
              type="file"
              accept="image/*,.pdf"
              required
              onChange={(e) => onFileChange(e, setIdentidadeFile)}
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
            disabled={enviando}
            className="w-full rounded-lg px-4 py-3 text-sm font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-70 hover:bg-[#00b838]"
            style={{ backgroundColor: VERDE }}
          >
            {enviando ? t('sending') : t('submit')}
          </button>
        </form>
      </section>
    </main>
  )
}
