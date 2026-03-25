'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type UsernameStatus = 'idle' | 'checking' | 'available' | 'unavailable'

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const usernameRegex = /^[a-z0-9._]{3,20}$/
const senhaMinima = 8
/** Mínimo 8 caracteres com pelo menos uma letra e um número */
const senhaForteRegex = /^(?=.*[A-Za-zÀ-ÿ])(?=.*\d).{8,}$/

const VERDE = '#00D443'

export default function CadastroTuristaPage() {
  const router = useRouter()

  const [nomeSocial, setNomeSocial] = useState('')
  const [nomeUsuario, setNomeUsuario] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [aceitePolitica, setAceitePolitica] = useState(false)
  const [aceiteTermos, setAceiteTermos] = useState(false)

  const [fotoPerfilFile, setFotoPerfilFile] = useState<File | null>(null)
  const [fotoPerfilPreview, setFotoPerfilPreview] = useState('')
  const [documentoFrenteFile, setDocumentoFrenteFile] = useState<File | null>(null)
  const [documentoVersoFile, setDocumentoVersoFile] = useState<File | null>(null)

  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle')
  const [usernameFeedback, setUsernameFeedback] = useState('')
  const [erroEnvio, setErroEnvio] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [modalDocumentoAberto, setModalDocumentoAberto] = useState(false)

  const emailValido = useMemo(() => emailRegex.test(email), [email])
  const senhaValida = useMemo(
    () => senha.length >= senhaMinima && senhaForteRegex.test(senha),
    [senha]
  )
  const usernameLimpo = useMemo(
    () => nomeUsuario.trim().toLowerCase().replace(/^@+/, ''),
    [nomeUsuario]
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
      setUsernameFeedback('Use 3-20 caracteres: letras minúsculas, números, ponto e _')
      return
    }
    let ativo = true
    setUsernameStatus('checking')
    setUsernameFeedback('Verificando disponibilidade...')
    const timer = setTimeout(async () => {
      const [turistasResp, profissionaisResp, empresasResp] = await Promise.all([
        supabase.from('turistas').select('id').eq('nome_usuario', usernameLimpo).limit(1),
        supabase.from('profissionais').select('id').eq('nome_usuario', usernameLimpo).limit(1),
        supabase.from('empresas').select('id').eq('nome_usuario', usernameLimpo).limit(1),
      ])
      if (!ativo) return
      if (turistasResp.error || profissionaisResp.error || empresasResp.error) {
        setUsernameStatus('unavailable')
        setUsernameFeedback('Nao foi possivel validar agora. Tente novamente.')
        return
      }
      const indisponivel =
        (turistasResp.data?.length ?? 0) > 0 ||
        (profissionaisResp.data?.length ?? 0) > 0 ||
        (empresasResp.data?.length ?? 0) > 0
      if (indisponivel) {
        setUsernameStatus('unavailable')
        setUsernameFeedback('🔴 Indisponivel')
      } else {
        setUsernameStatus('available')
        setUsernameFeedback('🟢 Disponivel')
      }
    }, 400)
    return () => {
      ativo = false
      clearTimeout(timer)
    }
  }, [usernameLimpo])

  const onFileChange = (
    event: ChangeEvent<HTMLInputElement>,
    setter: (file: File | null) => void
  ) => {
    setter(event.target.files?.[0] ?? null)
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

  const inputFileClass =
    'block w-full rounded-lg bg-[#0097b2] text-white file:mr-3 file:rounded-md file:border-0 file:bg-white/20 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white file:italic px-3 py-2 text-sm placeholder:italic placeholder:text-white/80'

  const validarFormulario = () => {
    if (!nomeSocial.trim()) return 'Informe o nome social.'
    if (!usernameLimpo || usernameStatus !== 'available') return 'Escolha um nome de usuario disponivel.'
    if (!emailValido) return 'Informe um e-mail valido.'
    if (!senhaValida) return 'A senha deve ter no mínimo 8 caracteres, com letras e números.'
    if (senha !== confirmarSenha) return 'As senhas não coincidem.'
    if (!documentoFrenteFile || !documentoVersoFile) return 'Envie frente e verso do documento.'
    if (!aceitePolitica || !aceiteTermos) return 'Aceite a política de privacidade e os termos de uso.'
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
      if (!userId) throw new Error('Nao foi possivel obter o usuario autenticado.')
      const documentoFrenteUrl = await uploadArquivo(documentoFrenteFile as File, 'documentos', userId)
      const documentoVersoUrl = await uploadArquivo(documentoVersoFile as File, 'documentos', userId)
      const fotoPerfilUrl = fotoPerfilFile
        ? await uploadArquivo(fotoPerfilFile, 'foto-perfil', userId)
        : null
      const payloadTurista: Record<string, string> = {
        usuario_id: userId,
        nome_completo: nomeSocial.trim(),
        nome_usuario: usernameLimpo,
        documento_frente_url: documentoFrenteUrl,
        documento_verso_url: documentoVersoUrl,
        status: 'pre_aprovado',
      }
      if (fotoPerfilUrl) payloadTurista.foto_perfil_url = fotoPerfilUrl
      let insertTurista = await supabase.from('turistas').insert(payloadTurista)
      if (
        insertTurista.error &&
        payloadTurista.foto_perfil_url &&
        insertTurista.error.message.toLowerCase().includes('foto_perfil_url')
      ) {
        delete payloadTurista.foto_perfil_url
        insertTurista = await supabase.from('turistas').insert(payloadTurista)
      }
      if (insertTurista.error && insertTurista.error.message.toLowerCase().includes('status')) {
        delete payloadTurista.status
        insertTurista = await supabase.from('turistas').insert(payloadTurista)
      }
      if (insertTurista.error) throw new Error(insertTurista.error.message)
      const upsertUsuario = await supabase.from('usuarios').upsert(
        { id: userId, email: email.trim().toLowerCase(), role: 'turista' },
        { onConflict: 'id' }
      )
      if (upsertUsuario.error) throw new Error(upsertUsuario.error.message)
      router.push(`/confirmar-email?email=${encodeURIComponent(email.trim().toLowerCase())}`)
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro inesperado ao concluir cadastro.'
      setErroEnvio(mensagem)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#0097b2] flex flex-col items-center justify-center p-4">
      <div className="flex justify-center mb-4 w-full max-w-md">
        <Image src="/logo.png" width={150} height={50} alt="Guia 3F" priority />
      </div>

      <section className="bg-white rounded-2xl border-2 border-[#0097b2] p-6 w-full max-w-md shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1)]">
        <h1 className="text-xl font-bold text-[#0097b2] text-center mb-4">Ficha de Cadastro TURISTA</h1>

        <div className="rounded-xl bg-gray-100 p-5">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="nomeSocial" className="mb-1 block text-xs font-medium italic text-[#001f3f]">
                Nome social
              </label>
              <input
                id="nomeSocial"
                type="text"
                required
                value={nomeSocial}
                onChange={(e) => setNomeSocial(e.target.value)}
                className="w-full rounded-lg bg-[#0097b2] text-white placeholder:italic placeholder:text-white/80 px-4 py-3 text-sm outline-none"
              />
            </div>

            <div>
              <label htmlFor="nomeUsuario" className="mb-1 block text-xs font-medium italic text-[#001f3f]">
                @username
              </label>
              <input
                id="nomeUsuario"
                type="text"
                required
                value={nomeUsuario}
                onChange={(e) => setNomeUsuario(e.target.value)}
                placeholder="@seuusuario"
                className="w-full rounded-lg bg-[#0097b2] text-white placeholder:italic placeholder:text-white/80 px-4 py-3 text-sm outline-none"
              />
              <p className="mt-1 text-xs text-[#001f3f] not-italic">{usernameFeedback}</p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="fotoPerfil" className="mb-1 block text-xs font-medium italic text-[#001f3f]">
                  Foto
                </label>
                <input
                  id="fotoPerfil"
                  type="file"
                  accept="image/*"
                  onChange={(e) => onFileChange(e, setFotoPerfilFile)}
                  className={inputFileClass}
                  aria-label="anexar arquivo foto"
                />
                {fotoPerfilPreview && (
                  <img
                    src={fotoPerfilPreview}
                    alt=""
                    className="mt-2 h-16 w-16 rounded-full object-cover border border-gray-200"
                  />
                )}
              </div>
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-xs font-medium italic text-[#001f3f]">Documento</span>
                  <button
                    type="button"
                    aria-label="Por que cadastrar meu documento?"
                    onClick={() => setModalDocumentoAberto(true)}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#001f3f] text-xs font-bold text-[#001f3f] hover:bg-[#001f3f] hover:text-white"
                  >
                    i
                  </button>
                </div>
                <input
                  id="documentoFrente"
                  type="file"
                  accept="image/*,.pdf"
                  required
                  onChange={(e) => onFileChange(e, setDocumentoFrenteFile)}
                  className={`${inputFileClass} mb-2`}
                  aria-label="Documento frente"
                />
                <input
                  id="documentoVerso"
                  type="file"
                  accept="image/*,.pdf"
                  required
                  onChange={(e) => onFileChange(e, setDocumentoVersoFile)}
                  className={inputFileClass}
                  aria-label="Documento verso"
                />
                <p className="mt-1 text-[10px] italic text-[#001f3f]/80">Frente e Verso</p>
              </div>
            </div>

            <div>
              <label htmlFor="email" className="mb-1 block text-xs font-medium italic text-[#001f3f]">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg bg-[#0097b2] text-white placeholder:italic placeholder:text-white/80 px-4 py-3 text-sm outline-none"
              />
              <p className={`mt-1 text-xs ${email && !emailValido ? 'text-red-600' : 'text-[#001f3f]'} not-italic`}>
                {email && !emailValido ? 'E-mail invalido.' : ''}
              </p>
            </div>

            <div>
              <label htmlFor="senha" className="mb-1 block text-xs font-medium italic text-[#001f3f]">
                Senha
              </label>
              <input
                id="senha"
                type="password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full rounded-lg bg-[#0097b2] text-white px-4 py-3 text-sm outline-none"
              />
            </div>

            <div>
              <label htmlFor="confirmarSenha" className="mb-1 block text-xs font-medium italic text-[#001f3f]">
                Confirmar Senha
              </label>
              <input
                id="confirmarSenha"
                type="password"
                required
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                placeholder="mínimo de 8 caracteres (com letras e números)"
                className="w-full rounded-lg bg-[#0097b2] text-white placeholder:italic placeholder:text-white/75 px-4 py-3 text-sm outline-none"
              />
            </div>

            <div className="flex flex-wrap items-start gap-4 text-xs italic text-[#001f3f]">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={aceitePolitica}
                  onChange={(e) => setAceitePolitica(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-400"
                />
                <Link href="/politicas" className="underline hover:text-[#0097b2]">
                  Política de privacidade
                </Link>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={aceiteTermos}
                  onChange={(e) => setAceiteTermos(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-400"
                />
                <Link href="/regras" className="underline hover:text-[#0097b2]">
                  Termos de uso
                </Link>
              </label>
            </div>

            {erroEnvio && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{erroEnvio}</p>}

            <button
              type="submit"
              disabled={enviando}
              className="w-full rounded-full px-4 py-3.5 text-sm font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-70 hover:bg-[#00b838]"
              style={{ backgroundColor: VERDE }}
            >
              {enviando ? 'Enviando...' : 'CONFIRMAR'}
            </button>
          </form>
        </div>
      </section>

      {modalDocumentoAberto ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="doc-modal-title"
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border-2 border-[#0097b2] bg-white p-6 shadow-xl">
            <h2 id="doc-modal-title" className="mb-4 text-center text-lg font-bold text-[#0097b2]">
              Porque cadastrar meu documento?
            </h2>
            <div className="space-y-3 text-sm text-[#001f3f]">
              <p>
                Seu documento de identificação é necessário para garantir mais segurança para você comprar ingressos ou
                contratar serviços, protegendo sua conta contra acessos indevidos e garantindo que apenas você realize
                transações.
              </p>
              <p>
                <span className="font-bold">Segurança:</span> O uso de autenticação digital proporciona maior segurança
                nas transações, reduzindo riscos de fraudes para você comprar com tranquilidade e sem preocupações.
              </p>
              <p>
                <span className="font-bold">Proteção de dados:</span> Seus dados serão armazenados de forma criptografada,
                seguindo as normas de proteção de informações.
              </p>
              <p>
                <span className="font-bold">Estudos econômicos:</span> Nossa plataforma também trabalha para oferecer
                estatísticas assertivas para o comércio da tríplice fronteira, para melhorarmos os serviços oferecidos na
                região; um cadastro seguro ajuda a evitar fraudes na base de dados.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setModalDocumentoAberto(false)}
              className="mt-6 w-full rounded-full bg-[#0097b2] py-3 font-bold text-white hover:opacity-95"
            >
              ENTENDI
            </button>
          </div>
        </div>
      ) : null}
    </main>
  )
}
