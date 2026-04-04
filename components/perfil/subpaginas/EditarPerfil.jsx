'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import Cropper from 'react-easy-crop'
import { supabase } from '@/lib/supabase'

/**
 * @param {string} url
 * @returns {Promise<HTMLImageElement>}
 */
function createImage(url) {
  return new Promise((resolve, reject) => {
    const image = new window.Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (e) => reject(e))
    image.crossOrigin = 'anonymous'
    image.src = url
  })
}

/**
 * @param {string} imageSrc
 * @param {{ x: number, y: number, width: number, height: number }} pixelCrop
 * @returns {Promise<Blob>}
 */
async function getCroppedImg(imageSrc, pixelCrop) {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas não suportado')
  canvas.width = Math.round(pixelCrop.width)
  canvas.height = Math.round(pixelCrop.height)
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  )
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('Falha ao gerar imagem'))
        else resolve(blob)
      },
      'image/jpeg',
      0.92
    )
  })
}

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
  const [cropModal, setCropModal] = useState(false)
  const [cropSrc, setCropSrc] = useState(/** @type {string | null} */ (null))
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(
    /** @type {{ x: number, y: number, width: number, height: number } | null} */ (null)
  )
  const [aplicandoCrop, setAplicandoCrop] = useState(false)
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

  const fecharCrop = useCallback(() => {
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
    setCropModal(false)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedAreaPixels(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [cropSrc])

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

    const podeRecortar =
      ['jpg', 'jpeg', 'png'].includes(ext) || file.type === 'image/jpeg' || file.type === 'image/png'
    if (podeRecortar) {
      const url = URL.createObjectURL(file)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setCroppedAreaPixels(null)
      setCropSrc(url)
      setCropModal(true)
    } else {
      setNovaFotoArquivo(file)
    }
  }

  const aplicarRecorte = async () => {
    if (!cropSrc || !croppedAreaPixels) return
    setAplicandoCrop(true)
    setErroFoto(null)
    try {
      const blob = await getCroppedImg(cropSrc, croppedAreaPixels)
      const file = new File([blob], 'perfil.jpg', { type: 'image/jpeg' })
      setNovaFotoArquivo(file)
      fecharCrop()
    } catch {
      setErroFoto('Não foi possível recortar. Tente JPG ou PNG.')
      fecharCrop()
    } finally {
      setAplicandoCrop(false)
    }
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

  const atualizarPerfilComFallbackFoto = async (tabelaAlvo, payloadBase, fotoUrl) => {
    const payloads = fotoUrl
      ? [
          { ...payloadBase, foto_perfil_url: fotoUrl, foto_url: fotoUrl },
          { ...payloadBase, foto_perfil_url: fotoUrl },
          { ...payloadBase, foto_url: fotoUrl },
        ]
      : [payloadBase]

    let ultimoErro = null
    for (const payload of payloads) {
      const { error } = await supabase.from(tabelaAlvo).update(payload).eq('usuario_id', usuarioId)
      if (!error) return null
      ultimoErro = error
    }
    return ultimoErro
  }

  const salvar = async () => {
    setSalvando(true)
    setMsg(null)
    setErroFoto(null)
    try {
      const payloadBase = {
        nome_completo: nome.trim(),
        nome_usuario: username.trim().replace(/^@/, ''),
        bio: bio.trim() || null,
      }
      let fotoUrl = null
      if (novaFotoArquivo) {
        fotoUrl = await uploadFotoPerfil(novaFotoArquivo, usuarioId)
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
        error = await atualizarPerfilComFallbackFoto(tabelaAlvo, payloadBase, fotoUrl)
      } else {
        error = await atualizarPerfilComFallbackFoto(tabela, payloadBase, fotoUrl)
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
    } catch (e) {
      const erroMsg = e instanceof Error ? e.message : 'Erro ao salvar perfil.'
      setMsg(erroMsg)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="scrollbar-perfil max-h-[70vh] space-y-4 overflow-y-auto px-1 pb-4">
      <div>
        <label className="text-xs font-medium text-gray-500">Foto de perfil</label>
        <div className="mt-2 flex flex-col items-center gap-3">
          <div className="relative h-32 w-32 overflow-hidden rounded-lg bg-gray-100">
            {fotoExibida ? (
              <img src={fotoExibida} alt="Foto de perfil" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-4xl text-gray-400">
                {inicialNome || '?'}
              </div>
            )}
          </div>

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

      {cropModal && cropSrc ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) fecharCrop()
          }}
          role="presentation"
        >
          <div
            className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-xl bg-white shadow-xl"
            onClick={(ev) => ev.stopPropagation()}
            role="dialog"
            aria-labelledby="crop-titulo"
          >
            <div className="border-b border-gray-100 px-4 py-3">
              <h3 id="crop-titulo" className="text-base font-bold text-gray-900">
                Ajustar foto
              </h3>
              <p className="mt-1 text-xs text-gray-500">Arraste e use o zoom para enquadrar o rosto ou a área desejada.</p>
            </div>
            <div className="relative h-72 w-full bg-gray-900">
              <Cropper
                image={cropSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, areaPixels) => setCroppedAreaPixels(areaPixels)}
              />
            </div>
            <div className="px-4 pt-3">
              <label className="text-xs text-gray-500">Zoom</label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(ev) => setZoom(Number(ev.target.value))}
                className="mt-1 w-full"
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 p-4">
              <button
                type="button"
                onClick={fecharCrop}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={aplicandoCrop}
                onClick={() => void aplicarRecorte()}
                className="rounded-lg bg-[#0097b2] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {aplicandoCrop ? 'Processando…' : 'Aplicar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
