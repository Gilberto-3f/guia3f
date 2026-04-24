'use client'

import { useEffect, useMemo, useState } from 'react'
import { ROTULO_ABA_SERVICO } from '@/lib/empresaCategoria'
import type { EmpresaPreviewDraft } from '@/hooks/useEmpresaPreviewDraft'

function asNumberOrNull(v: string) {
  const t = v.trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function asStringOrNull(v: string) {
  const t = v.trim()
  return t ? t : null
}

export default function EmpresaPreviewEditorDrawer(props: {
  aberto: boolean
  onClose: () => void
  empresaBase: Record<string, unknown> | null
  draft: EmpresaPreviewDraft | null
  onSalvar: (patch: EmpresaPreviewDraft) => void
  onLimpar: () => void
}) {
  const { aberto, onClose, empresaBase, draft, onSalvar, onLimpar } = props

  const categorias = useMemo(() => Object.keys(ROTULO_ABA_SERVICO), [])

  const base = empresaBase ?? {}
  const merged = { ...base, ...(draft ?? {}) } as Record<string, unknown>

  const [nomeFantasia, setNomeFantasia] = useState('')
  const [nomeUsuario, setNomeUsuario] = useState('')
  const [fotoUrl, setFotoUrl] = useState('')
  const [descricaoLonga, setDescricaoLonga] = useState('')
  const [categoria, setCategoria] = useState('')
  const [cidade, setCidade] = useState('')
  const [endereco, setEndereco] = useState('')
  const [telefone, setTelefone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [website, setWebsite] = useState('')
  const [instagramRede, setInstagramRede] = useState('')
  const [facebookRede, setFacebookRede] = useState('')
  const [tiktokRede, setTiktokRede] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [ticketInteira, setTicketInteira] = useState('')
  const [ticketMeia, setTicketMeia] = useState('')
  const [precoDiaria, setPrecoDiaria] = useState('')

  useEffect(() => {
    if (!aberto) return
    setNomeFantasia(String(merged.nome_fantasia ?? ''))
    setNomeUsuario(String(merged.nome_usuario ?? ''))
    setFotoUrl(String(merged.foto_url ?? ''))
    setDescricaoLonga(String(merged.descricao_longa ?? ''))
    setCategoria(String(merged.categoria ?? ''))
    setCidade(String(merged.cidade ?? ''))
    setEndereco(String(merged.endereco ?? ''))
    setTelefone(String(merged.telefone ?? ''))
    setWhatsapp(String(merged.whatsapp ?? ''))
    setWebsite(String(merged.website ?? ''))
    const rsRaw = merged.redes_sociais
    const rs =
      rsRaw && typeof rsRaw === 'object' && !Array.isArray(rsRaw)
        ? (rsRaw as Record<string, unknown>)
        : null
    setInstagramRede(rs && rs.instagram != null ? String(rs.instagram) : '')
    setFacebookRede(rs && rs.facebook != null ? String(rs.facebook) : '')
    setTiktokRede(rs && rs.tiktok != null ? String(rs.tiktok) : '')
    setLatitude(merged.latitude == null ? '' : String(merged.latitude))
    setLongitude(merged.longitude == null ? '' : String(merged.longitude))
    setTicketInteira(merged.preco_ticket_inteira == null ? '' : String(merged.preco_ticket_inteira))
    setTicketMeia(merged.preco_ticket_meia == null ? '' : String(merged.preco_ticket_meia))
    setPrecoDiaria(merged.preco_diaria == null ? '' : String(merged.preco_diaria))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto])

  if (!aberto) return null

  const salvarAgora = () => {
    onSalvar({
      nome_fantasia: nomeFantasia.trim(),
      nome_usuario: nomeUsuario.trim(),
      foto_url: asStringOrNull(fotoUrl),
      descricao_longa: asStringOrNull(descricaoLonga),
      categoria: categoria.trim(),
      cidade: cidade.trim(),
      endereco: endereco.trim(),
      telefone: asStringOrNull(telefone),
      whatsapp: asStringOrNull(whatsapp),
      website: asStringOrNull(website),
      redes_sociais: {
        instagram: instagramRede.trim(),
        facebook: facebookRede.trim(),
        tiktok: tiktokRede.trim(),
      },
      latitude: asNumberOrNull(latitude),
      longitude: asNumberOrNull(longitude),
      preco_ticket_inteira: asNumberOrNull(ticketInteira),
      preco_ticket_meia: asNumberOrNull(ticketMeia),
      preco_diaria: asNumberOrNull(precoDiaria),
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[220]">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Fechar editor" onClick={onClose} />
      <aside
        className="absolute right-0 top-0 flex h-full w-[min(94vw,28rem)] flex-col overflow-hidden bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Editor da empresa"
      >
        <div className="border-b border-gray-100 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-gray-900">Editar empresa</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              Fechar
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-4">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Nome fantasia</span>
              <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={nomeFantasia} onChange={(e) => setNomeFantasia(e.target.value)} />
            </label>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Username</span>
              <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={nomeUsuario} onChange={(e) => setNomeUsuario(e.target.value)} />
            </label>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Foto (URL)</span>
              <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={fotoUrl} onChange={(e) => setFotoUrl(e.target.value)} placeholder="https://..." />
            </label>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Categoria (regra de abas)</span>
              <select className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                <option value="">(vazio)</option>
                {categorias.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Descrição longa</span>
              <textarea className="mt-1 min-h-24 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={descricaoLonga} onChange={(e) => setDescricaoLonga(e.target.value)} />
            </label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Cidade</span>
                <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={cidade} onChange={(e) => setCidade(e.target.value)} />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Endereço</span>
                <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={endereco} onChange={(e) => setEndereco(e.target.value)} />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Telefone</span>
                <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-gray-500">WhatsApp</span>
                <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
              </label>
            </div>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Website</span>
              <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." />
            </label>

            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Redes sociais (opcional)</p>
              <label className="mt-2 block">
                <span className="text-xs text-gray-600">Instagram (usuário ou URL)</span>
                <input
                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                  value={instagramRede}
                  onChange={(e) => setInstagramRede(e.target.value)}
                  placeholder="@empresa ou https://..."
                />
              </label>
              <label className="mt-2 block">
                <span className="text-xs text-gray-600">Facebook (página ou URL)</span>
                <input
                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                  value={facebookRede}
                  onChange={(e) => setFacebookRede(e.target.value)}
                  placeholder="nome-da-pagina ou https://..."
                />
              </label>
              <label className="mt-2 block">
                <span className="text-xs text-gray-600">TikTok (usuário ou URL)</span>
                <input
                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                  value={tiktokRede}
                  onChange={(e) => setTiktokRede(e.target.value)}
                  placeholder="@empresa ou https://..."
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Latitude</span>
                <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={latitude} onChange={(e) => setLatitude(e.target.value)} />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Longitude</span>
                <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={longitude} onChange={(e) => setLongitude(e.target.value)} />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Ticket inteira</span>
                <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={ticketInteira} onChange={(e) => setTicketInteira(e.target.value)} />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Ticket meia</span>
                <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={ticketMeia} onChange={(e) => setTicketMeia(e.target.value)} />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Diária</span>
                <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={precoDiaria} onChange={(e) => setPrecoDiaria(e.target.value)} />
              </label>
            </div>

          </div>
        </div>

        <div className="border-t border-gray-100 p-4">
          <div className="flex gap-2">
            <button type="button" onClick={() => { onLimpar(); onClose() }} className="flex-1 rounded-lg border border-gray-200 bg-white py-2 text-sm font-bold text-gray-700 hover:bg-gray-50">
              Limpar
            </button>
            <button type="button" onClick={salvarAgora} className="flex-1 rounded-lg bg-[#0097b2] py-2 text-sm font-bold text-white hover:opacity-95">
              Salvar
            </button>
          </div>
        </div>
      </aside>
    </div>
  )
}

