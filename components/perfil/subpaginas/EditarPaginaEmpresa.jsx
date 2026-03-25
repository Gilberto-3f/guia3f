'use client'

import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

const CIDADES = ['Foz do Iguaçu', 'Ciudad del Este', 'Puerto Iguazú']
const CATEGORIAS = ['Restaurantes', 'Atrativos', 'Lojas', 'Hospedagem', 'Compras Paraguai', 'Eventos', 'Mobilidade']

/**
 * @param {{ empresa: Record<string, unknown>, empresaId: string, onSalvo?: () => void }} props
 */
export default function EditarPaginaEmpresa({ empresa, empresaId, onSalvo }) {
  const fotos = useMemo(() => {
    const f = empresa.fotos_url
    return Array.isArray(f) ? f.filter((x) => typeof x === 'string') : []
  }, [empresa.fotos_url])
  const fotos360 = useMemo(() => {
    const f = empresa.fotos_360_url
    return Array.isArray(f) ? f.filter((x) => typeof x === 'string') : []
  }, [empresa.fotos_360_url])
  const redesIn = (empresa.redes_sociais && typeof empresa.redes_sociais === 'object' && !Array.isArray(empresa.redes_sociais)
    ? /** @type {Record<string, string>} */ (empresa.redes_sociais)
    : {}) || {}

  const [formData, setFormData] = useState({
    nome: String(empresa.nome_fantasia ?? ''),
    username: String(empresa.nome_usuario ?? ''),
    categoria: String(empresa.categoria ?? 'Restaurantes'),
    cidade: String(empresa.cidade ?? CIDADES[0]),
    endereco: String(empresa.endereco ?? ''),
    telefone: String(empresa.telefone ?? ''),
    whatsapp: String(empresa.whatsapp ?? ''),
    website: String(empresa.website ?? ''),
    descricaoCurta: String(empresa.descricao_curta ?? empresa.descricao ?? '').slice(0, 170),
    descricaoLonga: String(empresa.descricao_longa ?? '').slice(0, 350),
    precoTicketInteira: Number(empresa.preco_ticket_inteira) || 0,
    precoTicketMeia: Number(empresa.preco_ticket_meia) || 0,
    precoDiaria: Number(empresa.preco_diaria) || 0,
    redes: {
      facebook: redesIn.facebook ?? '',
      instagram: redesIn.instagram ?? '',
      tiktok: redesIn.tiktok ?? '',
    },
    cozinha: 'Brasileira',
    faixaPreco: '$$',
    modeloReserva: 'Pré-reserva',
    nQuartos: 0,
  })

  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState(/** @type {string | null} */ (null))

  const configEspecifica =
    formData.categoria === 'Restaurantes' ? (
      <div className="space-y-3 rounded-xl border border-gray-100 p-3">
        <h4 className="font-semibold text-gray-800">Restaurante</h4>
        <div>
          <label className="text-xs text-gray-500">Tipo de cozinha</label>
          <select
            className="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm"
            value={formData.cozinha}
            onChange={(e) => setFormData((p) => ({ ...p, cozinha: e.target.value }))}
          >
            <option>Italiana</option>
            <option>Japonesa</option>
            <option>Brasileira</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500">Faixa de preço</label>
          <select
            className="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm"
            value={formData.faixaPreco}
            onChange={(e) => setFormData((p) => ({ ...p, faixaPreco: e.target.value }))}
          >
            <option>$</option>
            <option>$$</option>
            <option>$$$</option>
          </select>
        </div>
      </div>
    ) : formData.categoria === 'Hospedagem' ? (
      <div className="space-y-3 rounded-xl border border-gray-100 p-3">
        <h4 className="font-semibold text-gray-800">Hospedagem</h4>
        <div>
          <label className="text-xs text-gray-500">Modelo de reserva</label>
          <select
            className="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm"
            value={formData.modeloReserva}
            onChange={(e) => setFormData((p) => ({ ...p, modeloReserva: e.target.value }))}
          >
            <option>Pré-reserva</option>
            <option>Pagamento antecipado</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500">Número de quartos</label>
          <input
            type="number"
            min={0}
            className="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm"
            value={formData.nQuartos}
            onChange={(e) => setFormData((p) => ({ ...p, nQuartos: Number(e.target.value) }))}
          />
        </div>
      </div>
    ) : null

  const salvar = async () => {
    setSalvando(true)
    setMsg(null)
    try {
      const { error } = await supabase
        .from('empresas')
        .update({
          nome_fantasia: formData.nome.trim(),
          nome_usuario: formData.username.trim().replace(/^@/, ''),
          categoria: formData.categoria,
          cidade: formData.cidade,
          endereco: formData.endereco.trim() || null,
          telefone: formData.telefone.trim() || null,
          whatsapp: formData.whatsapp.trim() || null,
          website: formData.website.trim() || null,
          descricao_curta: formData.descricaoCurta.trim() || null,
          descricao_longa: formData.descricaoLonga.trim() || null,
          preco_ticket_inteira: formData.precoTicketInteira || null,
          preco_ticket_meia: formData.precoTicketMeia || null,
          preco_diaria: formData.precoDiaria || null,
          redes_sociais: formData.redes,
        })
        .eq('id', empresaId)

      if (error) {
        setMsg(error.message)
        return
      }
      setMsg('Alterações salvas.')
      onSalvo?.()
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="scrollbar-perfil max-h-[70vh] space-y-6 overflow-y-auto px-1 pb-6">
      <section className="space-y-3">
        <h3 className="text-lg font-bold text-gray-900">Informações básicas</h3>
        <input
          type="text"
          placeholder="Nome da empresa"
          value={formData.nome}
          onChange={(e) => setFormData((p) => ({ ...p, nome: e.target.value }))}
          className="w-full rounded-lg border border-gray-200 p-2 text-sm"
        />
        <input
          type="text"
          placeholder="@username"
          value={formData.username}
          onChange={(e) => setFormData((p) => ({ ...p, username: e.target.value }))}
          className="w-full rounded-lg border border-gray-200 p-2 text-sm"
        />
        <select
          value={formData.categoria}
          onChange={(e) => setFormData((p) => ({ ...p, categoria: e.target.value }))}
          className="w-full rounded-lg border border-gray-200 p-2 text-sm"
        >
          {CATEGORIAS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
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
        <input
          type="text"
          placeholder="Endereço completo"
          value={formData.endereco}
          onChange={(e) => setFormData((p) => ({ ...p, endereco: e.target.value }))}
          className="w-full rounded-lg border border-gray-200 p-2 text-sm"
        />
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-bold text-gray-900">Contato</h3>
        <input
          type="tel"
          placeholder="Telefone"
          value={formData.telefone}
          onChange={(e) => setFormData((p) => ({ ...p, telefone: e.target.value }))}
          className="w-full rounded-lg border border-gray-200 p-2 text-sm"
        />
        <input
          type="tel"
          placeholder="WhatsApp"
          value={formData.whatsapp}
          onChange={(e) => setFormData((p) => ({ ...p, whatsapp: e.target.value }))}
          className="w-full rounded-lg border border-gray-200 p-2 text-sm"
        />
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
        <h3 className="text-lg font-bold text-gray-900">Mídia</h3>
        <p className="text-xs text-gray-500">Fotos atuais ({fotos.length}). Upload em fluxo dedicado em breve.</p>
        <div className="grid grid-cols-3 gap-2">
          {fotos.slice(0, 6).map((u, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={u} alt="" className="aspect-square rounded-lg object-cover" />
          ))}
          <div className="flex aspect-square items-center justify-center rounded-lg border-2 border-dashed border-gray-200 text-gray-400">
            +
          </div>
        </div>
        <p className="text-xs text-gray-500">Tour 360° ({fotos360.length} fotos)</p>
        <div className="grid grid-cols-3 gap-2">
          {fotos360.slice(0, 3).map((u, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={u} alt="" className="aspect-square rounded-lg object-cover" />
          ))}
        </div>
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

      <section className="space-y-3">
        <h3 className="text-lg font-bold text-gray-900">Preços (botões dinâmicos)</h3>
        <input
          type="number"
          placeholder="Ticket inteira (R$)"
          value={formData.precoTicketInteira || ''}
          onChange={(e) => setFormData((p) => ({ ...p, precoTicketInteira: Number(e.target.value) }))}
          className="w-full rounded-lg border border-gray-200 p-2 text-sm"
        />
        <input
          type="number"
          placeholder="Ticket meia (R$)"
          value={formData.precoTicketMeia || ''}
          onChange={(e) => setFormData((p) => ({ ...p, precoTicketMeia: Number(e.target.value) }))}
          className="w-full rounded-lg border border-gray-200 p-2 text-sm"
        />
        <input
          type="number"
          placeholder="Diária (R$)"
          value={formData.precoDiaria || ''}
          onChange={(e) => setFormData((p) => ({ ...p, precoDiaria: Number(e.target.value) }))}
          className="w-full rounded-lg border border-gray-200 p-2 text-sm"
        />
      </section>

      {configEspecifica}

      {msg ? <p className="text-sm text-[#0097b2]">{msg}</p> : null}

      <button
        type="button"
        disabled={salvando}
        onClick={() => void salvar()}
        className="w-full rounded-xl bg-[#0097b2] py-3 text-sm font-bold text-white disabled:opacity-50"
      >
        {salvando ? 'Salvando…' : 'SALVAR ALTERAÇÕES'}
      </button>
    </div>
  )
}
