'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { supabase } from '@/lib/supabase'

/**
 * @param {{
 *   usuarioId: string
 *   role: 'turista' | 'profissional' | 'admin'
 *   nomeInicial: string
 *   usernameInicial: string
 *   bioInicial: string
 *   fotoInicial?: string | null
 *   onSalvo?: () => void
 * }} props
 */
export default function EditarPerfil({
  usuarioId,
  role,
  nomeInicial,
  usernameInicial,
  bioInicial,
  fotoInicial = null,
  onSalvo,
}) {
  const [nome, setNome] = useState(nomeInicial)
  const [username, setUsername] = useState(usernameInicial)
  const [bio, setBio] = useState(bioInicial)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState(/** @type {string | null} */ (null))
  const [fotoAtual, setFotoAtual] = useState(/** @type {string | null} */ (fotoInicial))
  const [novaFotoArquivo, setNovaFotoArquivo] = useState(/** @type {File | null} */ (null))
  const [previewFoto, setPreviewFoto] = useState(/** @type {string | null} */ (null))
  const [erroFoto, setErroFoto] = useState(/** @type {string | null} */ (null))
  const fileInputRef = useRef(/** @type {HTMLInputElement | null} */ (null))

  useEffect(() => {
    setNome(nomeInicial)
    setUsername(usernameInicial)
    setBio(bioInicial)
  }, [nomeInicial, usernameInicial, bioInicial])

  useEffect(() => {
    setFotoAtual(fotoInicial)
  }, [fotoInicial])

  useEffect(() => {
    if (!novaFotoArquivo) {
      setPreviewFoto(null)
      return
    }
    const objectUrl = URL.createObjectURL(novaFotoArquivo)
    setPreviewFoto(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [novaFotoArquivo])

  const tabela = role === 'profissional' ? 'profissionais' : 'turistas'
  const fotoExibida = previewFoto || fotoAtual
  const inicialNome = useMemo(() => {
    const base = (nome || nomeInicial || '').trim()
    return base ? base.charAt(0).toUpperCase() : 'U'
  }, [nome, nomeInicial])

  const onSelecionarFoto = (/** @type {React.ChangeEvent<HTMLInputElement>} */ e) => {
    const file = e.target.files?.[0] ?? null
    setErroFoto(null)
    if (!file) return

    const tiposPermitidos = ['image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'image/heif']
    const ext = (file.name.split('.').pop() || '').toLowerCase()
    const extOk = ['jpg', 'jpeg', 'png', 'heic', 'heif'].includes(ext)
    const tipoOk = tiposPermitidos.includes(file.type) || extOk
    if (!tipoOk) {
      setErroFoto('Formato não suportado. Envie JPG, PNG ou HEIC.')
      e.target.value = ''
      return
    }

    const maxBytes = 5 * 1024 * 1024
    if (file.size > maxBytes) {
      setErroFoto('Arquivo muito grande. Limite de 5MB.')
      e.target.value = ''
      return
    }

    setNovaFotoArquivo(file)
  }

  const cancelarNovaFoto = () => {
    setNovaFotoArquivo(null)
    setPreviewFoto(null)
    setErroFoto(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const uploadFotoPerfil = async (file, userId) => {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const nomeSeguro = file.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${userId}/${Date.now()}_${nomeSeguro || `perfil.${ext}`}`
    const { error: uploadError } = await supabase.storage.from('fotos-perfil').upload(path, file, {
      cacheControl: '3600',
      upsert: true,
    })
    if (uploadError) throw uploadError
    const { data } = supabase.storage.from('fotos-perfil').getPublicUrl(path)
    return data.publicUrl
  }

  const salvar = async () => {
    setSalvando(true)
    setMsg(null)
    setErroFoto(null)
    try {
      const payload = {
        nome_completo: nome.trim(),
        nome_usuario: username.trim().replace(/^@/, ''),
        bio: bio.trim() || null,
      }
      if (novaFotoArquivo) {
        const fotoUrl = await uploadFotoPerfil(novaFotoArquivo, usuarioId)
        payload.foto_perfil_url = fotoUrl
        setFotoAtual(fotoUrl)
      }
      let error = null
      if (role === 'admin') {
        const { data: temTurista } = await supabase.from('turistas').select('usuario_id').eq('usuario_id', usuarioId).maybeSingle()
        const { data: temProf } = await supabase.from('profissionais').select('usuario_id').eq('usuario_id', usuarioId).maybeSingle()
        if (!temTurista && !temProf) {
          setMsg('Vincule um perfil turista ou profissional para editar dados aqui.')
          return
        }
        const tabelaAlvo = temTurista ? 'turistas' : 'profissionais'
        const res = await supabase.from(tabelaAlvo).update(payload).eq('usuario_id', usuarioId)
        error = res.error
      } else {
        const res = await supabase.from(tabela).update(payload).eq('usuario_id', usuarioId)
        error = res.error
      }

      if (error) {
        setMsg(error.message)
        return
      }
      setMsg('Perfil atualizado.')
      setNovaFotoArquivo(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      onSalvo?.()
      window.dispatchEvent(new Event('perfil-atualizado'))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="scrollbar-perfil max-h-[70vh] space-y-4 overflow-y-auto px-1 pb-4">
      <div>
        <label className="text-xs font-medium text-gray-500">Foto de perfil</label>
        <div className="mt-2 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="relative flex h-[120px] w-[120px] items-center justify-center overflow-hidden rounded-full border-[3px] border-[#0097b2] bg-gray-100"
            aria-label="Trocar foto de perfil"
          >
            {fotoExibida ? (
              <img src={fotoExibida} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-4xl font-semibold text-gray-500">{inicialNome}</span>
            )}
            <span className="absolute bottom-1 right-1 rounded-full bg-white p-1 text-[#0097b2] shadow">
              <Camera size={18} />
            </span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.heic,.heif,image/jpeg,image/png,image/heic,image/heif"
            className="hidden"
            onChange={onSelecionarFoto}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-[#0097b2] px-3 py-2 text-sm font-medium text-[#0097b2]"
          >
            <Camera size={16} />
            TROCAR FOTO
          </button>

          {novaFotoArquivo ? (
            <button
              type="button"
              onClick={cancelarNovaFoto}
              className="text-xs font-medium text-gray-500 underline"
            >
              Cancelar nova foto
            </button>
          ) : null}
        </div>
        {erroFoto ? <p className="mt-2 text-sm text-red-600">{erroFoto}</p> : null}
      </div>
      <div>
        <label className="text-xs font-medium text-gray-500">Nome</label>
        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm"
          maxLength={120}
        />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-500">@usuário</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value.replace(/^@/, ''))}
          className="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm"
          maxLength={60}
        />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-500">Descrição</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          className="mt-1 min-h-[100px] w-full rounded-lg border border-gray-200 p-2 text-sm"
          maxLength={170}
          placeholder="Conte um pouco sobre você…"
        />
        <p className="text-right text-xs text-gray-400">{bio.length}/170</p>
      </div>
      {msg ? <p className="text-sm text-[#0097b2]">{msg}</p> : null}
      <button
        type="button"
        disabled={salvando}
        onClick={() => void salvar()}
        className="w-full rounded-xl bg-[#0097b2] py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {salvando ? 'Salvando…' : 'Salvar'}
      </button>
    </div>
  )
}
