'use client'

import Image from 'next/image'
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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
const senhaMinima = 6
const minimoFotos = 3
const maxDescricao = 170

const AZUL = '#0097b2'
const VERDE = '#00D443'

const categorias: CategoriaEmpresa[] = [
  'Restaurantes',
  'Atrativos',
  'Lojas',
  'Hospedagem',
  'Compras Paraguai',
]
const cidades: CidadeEmpresa[] = ['Foz do Iguacu', 'Ciudad del Este', 'Puerto Iguazu']
const diasSemana = ['Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado', 'Domingo']

export default function CadastroEmpresaPage() {
  const router = useRouter()

  const [nomeFantasia, setNomeFantasia] = useState('')
  const [nomeUsuario, setNomeUsuario] = useState('')
  const [emailGestor, setEmailGestor] = useState('')
  const [senha, setSenha] = useState('')
  const [categoria, setCategoria] = useState<CategoriaEmpresa>('Restaurantes')
  const [cidade, setCidade] = useState<CidadeEmpresa>('Foz do Iguacu')
  const [enderecoCompleto, setEnderecoCompleto] = useState('')
  const [telefone, setTelefone] = useState('')
  const [whatsApp, setWhatsApp] = useState('')
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

  const usernameLimpo = useMemo(
    () => nomeUsuario.trim().toLowerCase().replace(/^@+/, ''),
    [nomeUsuario]
  )
  const emailValido = useMemo(() => emailRegex.test(emailGestor), [emailGestor])
  const senhaValida = useMemo(() => senha.length >= senhaMinima, [senha])
  const descricaoValida = useMemo(
    () => descricaoCurta.trim().length > 0 && descricaoCurta.length <= maxDescricao,
    [descricaoCurta]
  )
  const totalFotos = fotosFiles.length

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
      setUsernameFeedback('Use 3-20 caracteres: letras minusculas, numeros, ponto e _')
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
    if (!nomeFantasia.trim()) return 'Informe o nome fantasia.'
    if (!usernameLimpo || usernameStatus !== 'available') return 'Escolha um nome de usuario disponivel.'
    if (!emailValido) return 'Informe um e-mail valido.'
    if (!senhaValida) return `A senha precisa ter no minimo ${senhaMinima} caracteres.`
    if (!enderecoCompleto.trim()) return 'Informe o endereco completo.'
    if (!telefone.trim()) return 'Informe o telefone.'
    if (!whatsApp.trim()) return 'Informe o WhatsApp.'
    if (!descricaoValida) return `Descricao obrigatoria com ate ${maxDescricao} caracteres.`
    if (totalFotos < minimoFotos) return `Envie no minimo ${minimoFotos} fotos.`
    if (!documentoComercialFile) return 'Envie o documento comercial (CNPJ/RUC/CUIT).'
    if (!aceitePoliticas) return 'Voce precisa aceitar as politicas.'
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
        email: emailGestor.trim().toLowerCase(),
        password: senha,
        options: {
          emailRedirectTo: `${window.location.origin}/confirmar-email`,
        },
      })

      if (authResp.error) throw new Error(authResp.error.message)

      const userId = authResp.data.user?.id
      if (!userId) throw new Error('Nao foi possivel obter o usuario autenticado.')

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
      }

      if (logoUrl) {
        payloadCompleto.logo_url = logoUrl
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
        }
        insertEmpresa = await supabase.from('empresas').insert(payloadMinimo)
      }

      if (insertEmpresa.error) throw new Error(insertEmpresa.error.message)

      const upsertUsuario = await supabase.from('usuarios').upsert(
        {
          id: userId,
          email: emailGestor.trim().toLowerCase(),
          role: 'empresa',
        },
        { onConflict: 'id' }
      )

      if (upsertUsuario.error) throw new Error(upsertUsuario.error.message)

      router.push(`/confirmar-email?email=${encodeURIComponent(emailGestor.trim().toLowerCase())}`)
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro inesperado ao concluir cadastro.'
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
        <h1 className="text-2xl font-bold text-[#0097b2] text-center">Cadastro de Empresa</h1>
        <p className="mt-2 text-sm text-[#001f3f] text-center">Preencha os dados para continuar.</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="logo" className="mb-1 block text-sm font-medium text-[#001f3f]">
              Logo (opcional)
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
                alt="Preview da logo"
                className="mt-3 h-24 w-24 rounded-lg border border-gray-200 object-cover"
              />
            )}
          </div>

          <div>
            <label htmlFor="nomeFantasia" className="mb-1 block text-sm font-medium text-[#001f3f]">
              Nome fantasia *
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
              Nome de usuario @ *
            </label>
            <input
              id="nomeUsuario"
              type="text"
              required
              value={nomeUsuario}
              onChange={(e) => setNomeUsuario(e.target.value)}
              placeholder="@suaempresa"
              className="w-full rounded-lg bg-[#0097b2] text-white placeholder-white/70 px-4 py-3 text-sm outline-none"
            />
            <p className="mt-1 text-xs text-[#001f3f]">{usernameFeedback}</p>
          </div>

          <div>
            <label htmlFor="emailGestor" className="mb-1 block text-sm font-medium text-[#001f3f]">
              E-mail do gestor *
            </label>
            <input
              id="emailGestor"
              type="email"
              required
              value={emailGestor}
              onChange={(e) => setEmailGestor(e.target.value)}
              className="w-full rounded-lg bg-[#0097b2] text-white placeholder-white/70 px-4 py-3 text-sm outline-none"
            />
            <p className={`mt-1 text-xs ${emailGestor && !emailValido ? 'text-red-600' : 'text-[#001f3f]'}`}>
              {emailGestor && !emailValido ? 'E-mail invalido.' : 'Use um e-mail valido para acesso.'}
            </p>
          </div>

          <div>
            <label htmlFor="senha" className="mb-1 block text-sm font-medium text-[#001f3f]">
              Senha *
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
                ? `Senha curta. Minimo de ${senhaMinima} caracteres.`
                : `Senha com pelo menos ${senhaMinima} caracteres.`}
            </p>
          </div>

          <div>
            <label htmlFor="categoria" className="mb-1 block text-sm font-medium text-[#001f3f]">
              Categoria *
            </label>
            <select
              id="categoria"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as CategoriaEmpresa)}
              className="w-full rounded-lg bg-[#0097b2] text-white px-4 py-3 text-sm outline-none"
            >
              {categorias.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="cidade" className="mb-1 block text-sm font-medium text-[#001f3f]">
              Cidade *
            </label>
            <select
              id="cidade"
              value={cidade}
              onChange={(e) => setCidade(e.target.value as CidadeEmpresa)}
              className="w-full rounded-lg bg-[#0097b2] text-white px-4 py-3 text-sm outline-none"
            >
              {cidades.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="enderecoCompleto" className="mb-1 block text-sm font-medium text-[#001f3f]">
              Endereco completo *
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
              Telefone *
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
              WhatsApp *
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
            <label htmlFor="descricaoCurta" className="mb-1 block text-sm font-medium text-[#001f3f]">
              Descricao curta ({descricaoCurta.length}/{maxDescricao}) *
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
              Horarios de funcionamento *
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {diasSemana.map((dia) => (
                <label key={dia} className="flex items-center gap-2 rounded-lg border border-[#0097b2] p-2 text-sm text-[#001f3f]">
                  <input
                    type="checkbox"
                    checked={horariosSelecionados.includes(dia)}
                    onChange={() => toggleDia(dia)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span>{dia}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="fotosEmpresa" className="mb-1 block text-sm font-medium text-[#001f3f]">
              Fotos da empresa *
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
              {totalFotos}/{minimoFotos} fotos
            </p>
            {totalFotos < minimoFotos && (
              <p className="mt-1 text-xs text-red-600">Envie no minimo 3 fotos para continuar.</p>
            )}
            {fotosPreview.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {fotosPreview.map((url, index) => (
                  <img
                    key={`${url}-${index}`}
                    src={url}
                    alt={`Preview da foto ${index + 1}`}
                    className="h-20 w-full rounded-lg border border-gray-200 object-cover"
                  />
                ))}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="documentoComercial" className="mb-1 block text-sm font-medium text-[#001f3f]">
              Documento comercial (CNPJ/RUC/CUIT) *
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
            <span>Li e aceito as politicas de uso e privacidade.</span>
          </label>

          {erroEnvio && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{erroEnvio}</p>}

          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-lg px-4 py-3 text-sm font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-70 hover:bg-[#00b838]"
            style={{ backgroundColor: VERDE }}
          >
            {enviando ? 'Enviando...' : 'CONFIRMAR'}
          </button>
        </form>
      </section>
    </main>
  )
}
