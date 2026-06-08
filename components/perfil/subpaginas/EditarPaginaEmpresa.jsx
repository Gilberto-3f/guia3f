'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Camera, MessageCircle, Phone } from 'lucide-react'
import Cropper from 'react-easy-crop'
import { supabase } from '@/lib/supabase'
import { sanitizarPalavrasChave, MAX_PALAVRAS_CHAVE } from '@/lib/palavrasChaveGuia'

const CIDADES = ['Foz do Iguaçu', 'Ciudad del Este', 'Puerto Iguazú']

const DIAS_SEMANA_EDIT = [
  { key: 'segunda', label: 'Segunda-feira' },
  { key: 'terca', label: 'Terça-feira' },
  { key: 'quarta', label: 'Quarta-feira' },
  { key: 'quinta', label: 'Quinta-feira' },
  { key: 'sexta', label: 'Sexta-feira' },
  { key: 'sabado', label: 'Sábado' },
  { key: 'domingo', label: 'Domingo' },
]

/** @type {{ abre: string, fecha: string, fechado: boolean, pausa_almoco: boolean, almoco_inicio: string, almoco_fim: string }} */
const DEFAULT_DIA_HORARIO = {
  abre: '09:00',
  fecha: '18:00',
  fechado: false,
  pausa_almoco: false,
  almoco_inicio: '12:00',
  almoco_fim: '13:00',
}

/**
 * @param {string} t
 */
function padHhMm(t) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '').trim())
  if (!m) return '09:00'
  return `${m[1].padStart(2, '0')}:${m[2]}`
}

/**
 * @param {unknown} raw
 * @returns {Record<string, { abre: string, fecha: string, fechado: boolean, pausa_almoco: boolean, almoco_inicio: string, almoco_fim: string }>}
 */
function parseHorariosFromEmpresa(raw) {
  /** @type {Record<string, unknown>} */
  let obj = {}
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    obj = /** @type {Record<string, unknown>} */ (raw)
  } else if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw)
      if (p && typeof p === 'object' && !Array.isArray(p)) obj = /** @type {Record<string, unknown>} */ (p)
    } catch {
      obj = {}
    }
  }
  /** @type {Record<string, { abre: string, fecha: string, fechado: boolean, pausa_almoco: boolean, almoco_inicio: string, almoco_fim: string }>} */
  const out = {}
  for (const { key } of DIAS_SEMANA_EDIT) {
    const src = obj[key]
    if (src && typeof src === 'object' && !Array.isArray(src)) {
      const s = /** @type {Record<string, unknown>} */ (src)
      out[key] = {
        abre: padHhMm(String(s.abre ?? DEFAULT_DIA_HORARIO.abre)),
        fecha: padHhMm(String(s.fecha ?? DEFAULT_DIA_HORARIO.fecha)),
        fechado: Boolean(s.fechado),
        pausa_almoco: Boolean(s.pausa_almoco),
        almoco_inicio: padHhMm(String(s.almoco_inicio ?? DEFAULT_DIA_HORARIO.almoco_inicio)),
        almoco_fim: padHhMm(String(s.almoco_fim ?? DEFAULT_DIA_HORARIO.almoco_fim)),
      }
    } else {
      out[key] = { ...DEFAULT_DIA_HORARIO, fechado: key === 'domingo' }
    }
  }
  return out
}

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
 * @param {{ empresa: Record<string, unknown>, empresaId: string, onSalvo?: () => void }} props
 */
export default function EditarPaginaEmpresa({ empresa, empresaId, onSalvo }) {
  const fotos = useMemo(() => {
    const f = empresa.fotos_url
    return Array.isArray(f) ? f.filter((x) => typeof x === 'string') : []
  }, [empresa.fotos_url])
  const redesIn = (empresa.redes_sociais && typeof empresa.redes_sociais === 'object' && !Array.isArray(empresa.redes_sociais)
    ? /** @type {Record<string, string>} */ (empresa.redes_sociais)
    : {}) || {}

  const [formData, setFormData] = useState({
    nome: String(empresa.nome_fantasia ?? ''),
    username: String(empresa.nome_usuario ?? '')
      .replace(/^@+/, '')
      .replace(/\s/g, ''),
    cidade: String(empresa.cidade ?? CIDADES[0]),
    endereco: String(empresa.endereco ?? ''),
    bairro: String(empresa.bairro ?? ''),
    telefone: String(empresa.telefone ?? ''),
    whatsapp: String(empresa.whatsapp ?? ''),
    website: String(empresa.website ?? ''),
    descricaoCurta: String(empresa.descricao_curta ?? empresa.descricao ?? '').slice(0, 170),
    descricaoLonga: String(empresa.descricao_longa ?? '').slice(0, 350),
    redes: {
      facebook: redesIn.facebook ?? '',
      instagram: redesIn.instagram ?? '',
      tiktok: redesIn.tiktok ?? '',
    },
  })

  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState(/** @type {string | null} */ (null))

  const horariosInicial = useMemo(() => parseHorariosFromEmpresa(empresa.horarios), [empresa.horarios])
  const [horariosEdit, setHorariosEdit] = useState(horariosInicial)

  const palavrasInicial = useMemo(() => {
    const base = sanitizarPalavrasChave(empresa.palavras_chave)
    while (base.length < MAX_PALAVRAS_CHAVE) base.push('')
    return base.slice(0, MAX_PALAVRAS_CHAVE)
  }, [empresa.palavras_chave])
  const [palavrasChave, setPalavrasChave] = useState(palavrasInicial)

  useEffect(() => {
    setPalavrasChave(palavrasInicial)
  }, [palavrasInicial])

  useEffect(() => {
    setHorariosEdit(horariosInicial)
  }, [horariosInicial])

  const fotoInicial = useMemo(() => {
    const u = empresa.foto_url != null && String(empresa.foto_url).trim() !== '' ? String(empresa.foto_url).trim() : null
    const p =
      empresa.foto_perfil_url != null && String(empresa.foto_perfil_url).trim() !== ''
        ? String(empresa.foto_perfil_url).trim()
        : null
    return u || p || fotos[0] || null
  }, [empresa.foto_url, empresa.foto_perfil_url, fotos])
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
  const galeriaInputRef = useRef(/** @type {HTMLInputElement | null} */ (null))

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

  const fotoExibida = previewFoto || fotoAtual

  const inicialNome = useMemo(() => {
    const base = String(formData.nome || '').trim()
    return base ? base.charAt(0).toUpperCase() : 'E'
  }, [formData.nome])

  const fecharCrop = useCallback(() => {
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
    setCropModal(false)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedAreaPixels(null)
    if (galeriaInputRef.current) galeriaInputRef.current.value = ''
  }, [cropSrc])

  const onSelecionarFoto = (/** @type {React.ChangeEvent<HTMLInputElement>} */ e) => {
    const file = e.target.files?.[0] ?? null
    setErroFoto(null)
    if (!file) return

    const ext = (file.name.split('.').pop() || '').toLowerCase()
    const extOk = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif', 'bmp'].includes(ext)
    const mime = (file.type || '').toLowerCase()
    const tipoImagem = mime.startsWith('image/')
    const tipoOk = tipoImagem || extOk
    if (!tipoOk) {
      setErroFoto('Selecione um arquivo de imagem (JPG, PNG, WebP, HEIC, etc.).')
      e.target.value = ''
      return
    }

    const maxBytes = 5 * 1024 * 1024
    if (file.size > maxBytes) {
      setErroFoto('Arquivo muito grande. Limite de 5MB.')
      e.target.value = ''
      return
    }

    const isHeic = ext === 'heic' || ext === 'heif' || mime === 'image/heic' || mime === 'image/heif'
    const naoRecortaNoCanvas = isHeic || mime === 'image/svg+xml' || mime.startsWith('image/svg')
    const podeRecortar =
      !naoRecortaNoCanvas &&
      (['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'].includes(ext) ||
        mime === 'image/jpeg' ||
        mime === 'image/jpg' ||
        mime === 'image/png' ||
        mime === 'image/webp' ||
        mime === 'image/gif' ||
        mime === 'image/bmp' ||
        (tipoImagem && mime !== ''))

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
    e.target.value = ''
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

  const uploadFotoPerfilEmpresa = async (file) => {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const nomeSeguro = file.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `empresas/${empresaId}/perfil_${Date.now()}_${nomeSeguro || `perfil.${ext}`}`
    const { error: uploadError } = await supabase.storage.from('empresas').upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type || 'image/jpeg',
    })
    if (uploadError) throw uploadError
    const { data } = supabase.storage.from('empresas').getPublicUrl(path)
    return data.publicUrl
  }

  const salvar = async () => {
    setSalvando(true)
    setMsg(null)
    setErroFoto(null)
    try {
      let publicUrlPerfil = /** @type {string | null} */ (null)
      if (novaFotoArquivo) {
        try {
          publicUrlPerfil = await uploadFotoPerfilEmpresa(novaFotoArquivo)
        } catch (e) {
          const erroMsg = e instanceof Error ? e.message : 'Erro ao enviar foto.'
          setMsg(erroMsg)
          return
        }
      }

      const payload = {
        nome_fantasia: formData.nome.trim(),
        nome_usuario: formData.username.trim().replace(/^@/, ''),
        cidade: formData.cidade,
        endereco: formData.endereco.trim() || null,
        bairro: formData.bairro.trim() || null,
        horarios: horariosEdit,
        telefone: formData.telefone.trim() || null,
        whatsapp: formData.whatsapp.trim() || null,
        website: formData.website.trim() || null,
        descricao_curta: formData.descricaoCurta.trim() || null,
        descricao_longa: formData.descricaoLonga.trim() || null,
        redes_sociais: formData.redes,
        palavras_chave: sanitizarPalavrasChave(palavrasChave),
      }

      if (publicUrlPerfil) {
        payload.foto_url = publicUrlPerfil
        payload.fotos_url = [publicUrlPerfil, ...fotos.filter((u) => u !== publicUrlPerfil)]
      }

      const { error } = await supabase.from('empresas').update(payload).eq('id', empresaId)

      if (error) {
        setMsg(error.message)
        return
      }

      if (publicUrlPerfil) {
        setFotoAtual(publicUrlPerfil)
        setNovaFotoArquivo(null)
        if (galeriaInputRef.current) galeriaInputRef.current.value = ''
      }

      setMsg('Alterações salvas.')
      onSalvo?.()
      window.dispatchEvent(new Event('perfil-atualizado'))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="space-y-6 px-1 pb-2">
      <section className="space-y-3">
        <h3 className="text-lg font-bold text-gray-900">Informações básicas</h3>

        <div className="flex flex-col items-center gap-3 rounded-xl border border-gray-100 bg-white p-3">
          <div className="relative h-32 w-32 overflow-hidden rounded-lg bg-gray-100">
            {fotoExibida ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fotoExibida} alt="Foto de perfil" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-4xl text-gray-400">
                {inicialNome || '?'}
              </div>
            )}
          </div>

          <input
            ref={galeriaInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onSelecionarFoto}
          />

          <button
            type="button"
            onClick={() => galeriaInputRef.current?.click()}
            className="inline-flex w-full max-w-sm items-center justify-center gap-2 rounded-lg bg-[#0097b2] px-3 py-2 text-sm font-semibold text-white"
          >
            <Camera className="h-4 w-4 shrink-0" aria-hidden />
            Foto de Perfil
          </button>

          {erroFoto ? <p className="text-sm text-red-600">{erroFoto}</p> : null}
        </div>

        <input
          type="text"
          placeholder="Nome social"
          value={formData.nome}
          onChange={(e) => setFormData((p) => ({ ...p, nome: e.target.value }))}
          className="w-full rounded-lg border border-gray-200 p-2 text-sm"
        />
        <div className="flex items-stretch overflow-hidden rounded-lg border border-gray-200 bg-white">
          <span className="flex shrink-0 items-center border-r border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-gray-600">
            @
          </span>
          <input
            type="text"
            placeholder="username"
            autoComplete="username"
            value={formData.username}
            onChange={(e) => {
              const v = e.target.value.replace(/^@+/, '').replace(/\s/g, '')
              setFormData((p) => ({ ...p, username: v }))
            }}
            className="min-w-0 flex-1 border-0 bg-transparent p-2 text-sm outline-none"
            aria-label="Nome de utilizador"
          />
        </div>
        <input
          type="text"
          placeholder="Endereço (rua e número)"
          value={formData.endereco}
          onChange={(e) => setFormData((p) => ({ ...p, endereco: e.target.value }))}
          className="w-full rounded-lg border border-gray-200 p-2 text-sm"
        />
        <input
          type="text"
          placeholder="Bairro"
          value={formData.bairro}
          onChange={(e) => setFormData((p) => ({ ...p, bairro: e.target.value }))}
          className="w-full rounded-lg border border-gray-200 p-2 text-sm"
        />
        <select
          value={formData.cidade}
          onChange={(e) => setFormData((p) => ({ ...p, cidade: e.target.value }))}
          className="w-full rounded-lg border border-gray-200 p-2 text-sm"
        >
          {CIDADES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-bold text-gray-900">Horário de Funcionamento</h3>
        <div className="space-y-3">
          {DIAS_SEMANA_EDIT.map(({ key, label }) => {
            const h = horariosEdit[key]
            if (!h) return null
            return (
              <div key={key} className="min-w-0 space-y-2 overflow-hidden rounded-xl border border-gray-100 bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-gray-800">{label}</span>
                  <label className="flex items-center gap-2 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={h.fechado}
                      onChange={(e) =>
                        setHorariosEdit((prev) => ({
                          ...prev,
                          [key]: { ...prev[key], fechado: e.target.checked },
                        }))
                      }
                    />
                    Fechado
                  </label>
                </div>
                {!h.fechado ? (
                  <>
                    <div className="flex min-w-0 flex-row flex-nowrap items-end gap-2">
                      <div className="min-w-0 w-24 shrink-0">
                        <label className="block text-[10px] font-medium uppercase tracking-wide text-gray-500">Abre</label>
                        <input
                          type="time"
                          value={h.abre}
                          onChange={(e) =>
                            setHorariosEdit((prev) => ({
                              ...prev,
                              [key]: { ...prev[key], abre: e.target.value },
                            }))
                          }
                          className="mt-0.5 w-24 max-w-full rounded-lg border border-gray-200 bg-white px-1 py-1.5 text-sm text-gray-900 [color-scheme:light]"
                        />
                      </div>
                      <div className="min-w-0 w-24 shrink-0">
                        <label className="block text-[10px] font-medium uppercase tracking-wide text-gray-500">Fecha</label>
                        <input
                          type="time"
                          value={h.fecha}
                          onChange={(e) =>
                            setHorariosEdit((prev) => ({
                              ...prev,
                              [key]: { ...prev[key], fecha: e.target.value },
                            }))
                          }
                          className="mt-0.5 w-24 max-w-full rounded-lg border border-gray-200 bg-white px-1 py-1.5 text-sm text-gray-900 [color-scheme:light]"
                        />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-gray-700">
                      <input
                        type="checkbox"
                        checked={h.pausa_almoco}
                        onChange={(e) =>
                          setHorariosEdit((prev) => ({
                            ...prev,
                            [key]: { ...prev[key], pausa_almoco: e.target.checked },
                          }))
                        }
                      />
                      Pausa para o almoço?
                    </label>
                    {h.pausa_almoco ? (
                      <div className="flex min-w-0 flex-row flex-nowrap items-end gap-2 pl-0.5">
                        <div className="min-w-0 w-24 shrink-0">
                          <label className="block text-[10px] font-medium uppercase tracking-wide text-gray-500">
                            Início almoço
                          </label>
                          <input
                            type="time"
                            value={h.almoco_inicio}
                            onChange={(e) =>
                              setHorariosEdit((prev) => ({
                                ...prev,
                                [key]: { ...prev[key], almoco_inicio: e.target.value },
                              }))
                            }
                            className="mt-0.5 w-24 max-w-full rounded-lg border border-gray-200 bg-white px-1 py-1.5 text-sm text-gray-900 [color-scheme:light]"
                          />
                        </div>
                        <div className="min-w-0 w-24 shrink-0">
                          <label className="block text-[10px] font-medium uppercase tracking-wide text-gray-500">
                            Fim almoço
                          </label>
                          <input
                            type="time"
                            value={h.almoco_fim}
                            onChange={(e) =>
                              setHorariosEdit((prev) => ({
                                ...prev,
                                [key]: { ...prev[key], almoco_fim: e.target.value },
                              }))
                            }
                            className="mt-0.5 w-24 max-w-full rounded-lg border border-gray-200 bg-white px-1 py-1.5 text-sm text-gray-900 [color-scheme:light]"
                          />
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            )
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-bold text-gray-900">Adicionar Palavras-chave</h3>
        <p className="text-xs leading-relaxed text-gray-500">
          Até {MAX_PALAVRAS_CHAVE} termos relacionados ao seu segmento. Eles não aparecem na página pública, mas
          ajudam turistas e profissionais a encontrar sua empresa no motor de busca do guia.
        </p>
        <div className="space-y-2">
          {palavrasChave.map((valor, idx) => (
            <input
              key={`palavra-chave-${idx}`}
              type="text"
              placeholder={`Palavra-chave ${idx + 1}`}
              value={valor}
              onChange={(e) =>
                setPalavrasChave((prev) => {
                  const next = [...prev]
                  next[idx] = e.target.value
                  return next
                })
              }
              className="w-full rounded-lg border border-gray-200 p-2 text-sm text-gray-900"
              maxLength={60}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-bold text-gray-900">Contato</h3>
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2 focus-within:ring-2 focus-within:ring-[#0097b2]/30">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center text-[#0097b2]" title="Telefone" aria-hidden>
            <Phone className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <input
            type="tel"
            placeholder="Telefone"
            value={formData.telefone}
            onChange={(e) => setFormData((p) => ({ ...p, telefone: e.target.value }))}
            className="min-w-0 flex-1 border-0 bg-transparent py-2 pr-2 text-sm outline-none"
            aria-label="Telefone"
          />
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2 focus-within:ring-2 focus-within:ring-[#0097b2]/30">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center text-emerald-600" title="WhatsApp" aria-hidden>
            <MessageCircle className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <input
            type="tel"
            placeholder="WhatsApp"
            value={formData.whatsapp}
            onChange={(e) => setFormData((p) => ({ ...p, whatsapp: e.target.value }))}
            className="min-w-0 flex-1 border-0 bg-transparent py-2 pr-2 text-sm outline-none"
            aria-label="WhatsApp"
          />
        </div>
        <input
          type="url"
          placeholder="Website"
          value={formData.website}
          onChange={(e) => setFormData((p) => ({ ...p, website: e.target.value }))}
          className="w-full rounded-lg border border-gray-200 p-2 text-sm"
        />
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-bold text-gray-900">Descrições</h3>
        <textarea
          placeholder="Descrição curta (170 caracteres)"
          maxLength={170}
          value={formData.descricaoCurta}
          onChange={(e) => setFormData((p) => ({ ...p, descricaoCurta: e.target.value }))}
          className="h-20 w-full rounded-lg border border-gray-200 p-2 text-sm"
        />
        <textarea
          placeholder="Descrição longa (350 caracteres)"
          maxLength={350}
          value={formData.descricaoLonga}
          onChange={(e) => setFormData((p) => ({ ...p, descricaoLonga: e.target.value }))}
          className="h-32 w-full rounded-lg border border-gray-200 p-2 text-sm"
        />
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-bold text-gray-900">Redes sociais</h3>
        <input
          type="text"
          placeholder="Facebook"
          value={formData.redes.facebook}
          onChange={(e) => setFormData((p) => ({ ...p, redes: { ...p.redes, facebook: e.target.value } }))}
          className="w-full rounded-lg border border-gray-200 p-2 text-sm"
        />
        <input
          type="text"
          placeholder="Instagram"
          value={formData.redes.instagram}
          onChange={(e) => setFormData((p) => ({ ...p, redes: { ...p.redes, instagram: e.target.value } }))}
          className="w-full rounded-lg border border-gray-200 p-2 text-sm"
        />
        <input
          type="text"
          placeholder="TikTok"
          value={formData.redes.tiktok}
          onChange={(e) => setFormData((p) => ({ ...p, redes: { ...p.redes, tiktok: e.target.value } }))}
          className="w-full rounded-lg border border-gray-200 p-2 text-sm"
        />
      </section>

      {msg ? <p className="text-sm text-[#0097b2]">{msg}</p> : null}

      <button
        type="button"
        disabled={salvando}
        onClick={() => void salvar()}
        className="w-full rounded-xl bg-[#0097b2] py-3 text-sm font-bold text-white disabled:opacity-50"
      >
        {salvando ? 'Salvando…' : 'SALVAR ALTERAÇÕES'}
      </button>

      {cropModal && cropSrc ? (
        <div
          className="fixed inset-0 z-[240] flex items-center justify-center bg-black/70 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) fecharCrop()
          }}
          role="presentation"
        >
          <div
            className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-xl bg-white shadow-xl"
            onClick={(ev) => ev.stopPropagation()}
            role="dialog"
            aria-labelledby="crop-titulo-empresa"
          >
            <div className="border-b border-gray-100 px-4 py-3">
              <h3 id="crop-titulo-empresa" className="text-base font-bold text-gray-900">
                Ajustar foto
              </h3>
              <p className="mt-1 text-xs text-gray-500">Arraste e use gestos de pinça no celular para aproximar ou afastar.</p>
            </div>
            <div className="relative h-72 w-full bg-gray-900">
              <Cropper
                image={cropSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                zoomWithScroll={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, areaPixels) => setCroppedAreaPixels(areaPixels)}
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
