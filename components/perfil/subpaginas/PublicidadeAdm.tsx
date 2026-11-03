'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import type { EcossistemaBloco } from '@/lib/ecossistemas'

type AnuncioAdm = {
  id: string
  ecossistema_id: string | null
  imagem_url: string
  link_url: string | null
  periodo_inicio: string
  periodo_fim: string | null
  status: string
  ativo: boolean
  impressoes_exibidas?: number
  cliques?: number
}

type Destino = 'nenhum' | 'link' | 'whatsapp'
type Vigencia = 'recorrente' | 'prazo'

function hojeIso() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(value: string | null) {
  if (!value) return 'Recorrente'
  const d = new Date(`${value}T00:00:00`)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('pt-BR')
}

export default function PublicidadeAdm() {
  const [ecos, setEcos] = useState<EcossistemaBloco[]>([])
  const [anuncios, setAnuncios] = useState<AnuncioAdm[]>([])
  const [ecoId, setEcoId] = useState('')
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [finalizando, setFinalizando] = useState(false)

  const [arte, setArte] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [vigencia, setVigencia] = useState<Vigencia>('recorrente')
  const [periodoFim, setPeriodoFim] = useState('')
  const [destino, setDestino] = useState<Destino>('nenhum')
  const [linkUrl, setLinkUrl] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const fileRef = useRef<HTMLInputElement | null>(null)
  const previewRevoke = useRef<string | null>(null)

  const carregar = useCallback(async () => {
    setErro(null)
    const res = await fetch('/api/admin/publicidade', { credentials: 'include' })
    const json = (await res.json()) as {
      ok?: boolean
      error?: string
      ecossistemas?: EcossistemaBloco[]
      anuncios?: AnuncioAdm[]
    }
    if (!res.ok || !json.ok) throw new Error(json.error || 'Não foi possível carregar.')
    setEcos(json.ecossistemas ?? [])
    setAnuncios(json.anuncios ?? [])
    setEcoId((prev) => {
      if (prev && (json.ecossistemas ?? []).some((e) => e.id === prev)) return prev
      return json.ecossistemas?.[0]?.id ?? ''
    })
  }, [])

  useEffect(() => {
    let vivo = true
    setLoading(true)
    void carregar()
      .catch((e) => {
        if (vivo) setErro(e instanceof Error ? e.message : 'Erro ao carregar.')
      })
      .finally(() => {
        if (vivo) setLoading(false)
      })
    return () => {
      vivo = false
    }
  }, [carregar])

  useEffect(() => {
    return () => {
      if (previewRevoke.current) URL.revokeObjectURL(previewRevoke.current)
    }
  }, [])

  const ativoDoEco = useMemo(
    () => anuncios.find((a) => a.ecossistema_id === ecoId && a.ativo) ?? null,
    [anuncios, ecoId],
  )

  const limparForm = () => {
    if (previewRevoke.current) {
      URL.revokeObjectURL(previewRevoke.current)
      previewRevoke.current = null
    }
    setArte(null)
    setPreview(null)
    setVigencia('recorrente')
    setPeriodoFim('')
    setDestino('nenhum')
    setLinkUrl('')
    setWhatsapp('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const onArte = (f: File | null) => {
    if (previewRevoke.current) {
      URL.revokeObjectURL(previewRevoke.current)
      previewRevoke.current = null
    }
    setArte(f)
    if (f) {
      const url = URL.createObjectURL(f)
      previewRevoke.current = url
      setPreview(url)
    } else {
      setPreview(null)
    }
  }

  const publicar = async (substituir: boolean) => {
    if (!ecoId) {
      setMsg('Escolha o ecossistema.')
      return
    }
    if (!arte) {
      setMsg('Selecione a imagem (JPG, PNG ou WEBP).')
      return
    }
    if (vigencia === 'prazo' && !periodoFim) {
      setMsg('Informe a data final.')
      return
    }
    if (destino === 'link' && !linkUrl.trim()) {
      setMsg('Informe o link.')
      return
    }
    if (destino === 'whatsapp' && !whatsapp.trim()) {
      setMsg('Informe o WhatsApp.')
      return
    }
    setSalvando(true)
    setMsg(null)
    try {
      const fd = new FormData()
      fd.set('ecossistema_id', ecoId)
      fd.set('vigencia', vigencia)
      if (vigencia === 'prazo') fd.set('periodo_fim', periodoFim)
      fd.set('destino', destino)
      if (destino === 'link') fd.set('link_url', linkUrl)
      if (destino === 'whatsapp') fd.set('whatsapp', whatsapp)
      fd.set('arte', arte)
      if (substituir) fd.set('substituir', '1')
      const res = await fetch('/api/admin/publicidade', {
        method: 'POST',
        credentials: 'include',
        body: fd,
      })
      const json = (await res.json()) as { ok?: boolean; error?: string; code?: string }
      if (res.status === 409 && json.code === 'existe_ativo') {
        if (window.confirm(json.error || 'Já existe um banner ativo neste eco. Substituir?')) {
          await publicar(true)
        }
        return
      }
      if (!res.ok || !json.ok) throw new Error(json.error || 'Falha ao publicar.')
      setMsg('Banner publicado na home deste ecossistema.')
      limparForm()
      await carregar()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro ao publicar.')
    } finally {
      setSalvando(false)
    }
  }

  const finalizar = async () => {
    if (!ativoDoEco) return
    if (!window.confirm('Finalizar este banner? Ele sai da home deste ecossistema.')) return
    setFinalizando(true)
    setMsg(null)
    try {
      const res = await fetch(`/api/admin/publicidade/${ativoDoEco.id}`, {
        method: 'PATCH',
        credentials: 'include',
      })
      const json = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !json.ok) throw new Error(json.error || 'Falha ao finalizar.')
      setMsg('Banner finalizado.')
      await carregar()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro ao finalizar.')
    } finally {
      setFinalizando(false)
    }
  }

  if (loading) {
    return <p className="px-1 py-6 text-center text-sm text-gray-500">Carregando…</p>
  }
  if (erro) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{erro}</div>
    )
  }

  return (
    <div className="space-y-4 px-0 pb-6">
      <p className="text-sm text-[#666666]">
        Um banner ativo por ecossistema, junto com as empresas daquele bloco. Sem destino, só a arte.
      </p>

      <label className="block text-sm">
        <span className="font-semibold text-gray-800">Ecossistema</span>
        <select
          value={ecoId}
          onChange={(e) => setEcoId(e.target.value)}
          className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
        >
          {ecos.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
              {e.tipo === 'regiao' ? ' (região)' : ' (cidade)'}
            </option>
          ))}
        </select>
      </label>

      {ativoDoEco ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="mb-2 text-sm font-bold text-gray-900">Ativo neste eco</p>
          {ativoDoEco.imagem_url ? (
            <div className="relative mb-3 aspect-[2/1] w-full overflow-hidden rounded-lg bg-gray-100">
              <Image
                src={ativoDoEco.imagem_url}
                alt="Banner ativo"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 448px"
              />
            </div>
          ) : null}
          <p className="text-sm text-gray-700">
            Vigência: {formatDate(ativoDoEco.periodo_inicio)} — {formatDate(ativoDoEco.periodo_fim)}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {ativoDoEco.link_url ? `Destino: ${ativoDoEco.link_url}` : 'Só arte (sem ação)'}
          </p>
          <button
            type="button"
            onClick={() => void finalizar()}
            disabled={finalizando}
            className="mt-3 w-full rounded-xl bg-[#0097b2] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {finalizando ? 'Finalizando…' : 'Finalizar banner'}
          </button>
        </div>
      ) : (
        <p className="rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-600">Nenhum banner ADM ativo neste eco.</p>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-3 font-bold text-gray-900">{ativoDoEco ? 'Substituir criativo' : 'Novo banner'}</h3>

        <label className="mb-3 block text-sm">
          <span className="font-medium text-gray-800">Arte</span>
          <p className="mb-2 text-xs text-gray-500">JPG, PNG ou WEBP. Sugestão: 1200×600 px.</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => onArte(e.target.files?.[0] ?? null)}
            className="block w-full text-sm"
          />
        </label>
        {preview ? (
          <div className="relative mb-3 aspect-[2/1] w-full overflow-hidden rounded-lg bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Prévia" className="h-full w-full object-cover" />
          </div>
        ) : null}

        <p className="mb-1 text-sm font-medium text-gray-800">Vigência</p>
        <div className="mb-3 flex gap-2">
          {(
            [
              ['recorrente', 'Recorrente'],
              ['prazo', 'Prazo determinado'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setVigencia(id)}
              className={[
                'flex-1 rounded-xl py-2 text-xs font-bold uppercase',
                vigencia === id ? 'bg-[#0097b2] text-white' : 'border border-gray-200 bg-white text-[#0097b2]',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
        {vigencia === 'prazo' ? (
          <label className="mb-3 block text-sm">
            <span className="font-medium text-gray-800">Data final</span>
            <input
              type="date"
              min={hojeIso()}
              value={periodoFim}
              onChange={(e) => setPeriodoFim(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
        ) : (
          <p className="mb-3 text-xs text-gray-500">Fica no ar até você finalizar.</p>
        )}

        <p className="mb-1 text-sm font-medium text-gray-800">Ao tocar</p>
        <div className="mb-3 flex flex-wrap gap-2">
          {(
            [
              ['nenhum', 'Só arte'],
              ['link', 'Link'],
              ['whatsapp', 'WhatsApp'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setDestino(id)}
              className={[
                'rounded-xl px-3 py-2 text-xs font-bold uppercase',
                destino === id ? 'bg-[#0097b2] text-white' : 'border border-gray-200 bg-white text-[#0097b2]',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
        {destino === 'link' ? (
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://…"
            className="mb-3 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
          />
        ) : null}
        {destino === 'whatsapp' ? (
          <input
            type="tel"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="5543999999999"
            className="mb-3 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
          />
        ) : null}

        <button
          type="button"
          onClick={() => {
            if (ativoDoEco) {
              if (!window.confirm('Já existe um banner ativo neste ecossistema. Substituir pelo novo criativo?')) {
                return
              }
              void publicar(true)
              return
            }
            void publicar(false)
          }}
          disabled={salvando}
          className="w-full rounded-xl bg-[#00D443] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {salvando ? 'Publicando…' : ativoDoEco ? 'Publicar (substitui o ativo)' : 'Publicar'}
        </button>
      </div>

      {msg ? (
        <p className="text-sm text-gray-800" role="status">
          {msg}
        </p>
      ) : null}
    </div>
  )
}
