'use client'

import { useCallback, useEffect, useState } from 'react'
import { GripVertical, Megaphone, Pencil, Plus, Trash2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  CLS_FOTO_REJEITADA,
  indiceFotoRejeitada,
  normalizarErroCadastroEmpresa,
} from '@/lib/mensagensCadastroEmpresa'
import {
  PUBLICIDADE_EXTERNA_DESC_MAX,
  PUBLICIDADE_EXTERNA_FOTOS_MAX,
  PUBLICIDADE_EXTERNA_TITULO_MAX,
  listarCardsPublicidadeExterna,
  buscarConfigPublicidadeExterna,
  salvarWhatsappPublicidadeExterna,
  salvarOrdemCardsPublicidadeExterna,
  uploadFotosPublicidadeExterna,
  validarFormPublicidadeExterna,
  type PublicidadeExternaCard,
} from '@/lib/publicidadeExterna'

type FormState = {
  id: string | null
  titulo: string
  descricao: string
  fotosExistentes: string[]
  fotosNovas: File[]
  fotosNovasPreview: string[]
}

function formVazio(): FormState {
  return {
    id: null,
    titulo: '',
    descricao: '',
    fotosExistentes: [],
    fotosNovas: [],
    fotosNovasPreview: [],
  }
}

function formFromCard(card: PublicidadeExternaCard): FormState {
  return {
    id: card.id,
    titulo: card.titulo,
    descricao: card.descricao,
    fotosExistentes: [...card.fotos],
    fotosNovas: [],
    fotosNovasPreview: [],
  }
}

type Props = {
  podeEditar: boolean
  onMensagem: (msg: { tipo: 'sucesso' | 'erro'; texto: string } | null) => void
}

export function ConfigPublicidadeExterna({ podeEditar, onMensagem }: Props) {
  const [cards, setCards] = useState<PublicidadeExternaCard[]>([])
  const [whatsapp, setWhatsapp] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [formAberto, setFormAberto] = useState(false)
  const [form, setForm] = useState<FormState>(formVazio())
  const [salvando, setSalvando] = useState(false)
  const [salvandoWa, setSalvandoWa] = useState(false)
  const [erroForm, setErroForm] = useState<string | null>(null)
  const [fotoRejeitadaIndice, setFotoRejeitadaIndice] = useState<number | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const [lista, cfg] = await Promise.all([
        listarCardsPublicidadeExterna(supabase),
        buscarConfigPublicidadeExterna(supabase),
      ])
      setCards(lista)
      setWhatsapp(cfg?.whatsapp ?? '')
    } catch (e) {
      onMensagem({
        tipo: 'erro',
        texto: e instanceof Error ? e.message : 'Erro ao carregar publicidade externa.',
      })
    } finally {
      setCarregando(false)
    }
  }, [onMensagem])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const totalFotos = form.fotosExistentes.length + form.fotosNovas.length

  const abrirNovo = () => {
    form.fotosNovasPreview.forEach((u) => URL.revokeObjectURL(u))
    setForm(formVazio())
    setErroForm(null)
    setFotoRejeitadaIndice(null)
    setFormAberto(true)
  }

  const abrirEditar = (card: PublicidadeExternaCard) => {
    form.fotosNovasPreview.forEach((u) => URL.revokeObjectURL(u))
    setForm(formFromCard(card))
    setErroForm(null)
    setFotoRejeitadaIndice(null)
    setFormAberto(true)
  }

  const fecharForm = () => {
    form.fotosNovasPreview.forEach((u) => URL.revokeObjectURL(u))
    setForm(formVazio())
    setErroForm(null)
    setFotoRejeitadaIndice(null)
    setFormAberto(false)
  }

  const adicionarFotos = (files: FileList | null) => {
    if (!files?.length) return
    const restam = Math.max(0, PUBLICIDADE_EXTERNA_FOTOS_MAX - totalFotos)
    const escolhidos = Array.from(files).slice(0, restam)
    if (!escolhidos.length) return
    const previews = escolhidos.map((f) => URL.createObjectURL(f))
    setFotoRejeitadaIndice(null)
    setErroForm(null)
    setForm((prev) => ({
      ...prev,
      fotosNovas: [...prev.fotosNovas, ...escolhidos],
      fotosNovasPreview: [...prev.fotosNovasPreview, ...previews],
    }))
  }

  const removerExistente = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      fotosExistentes: prev.fotosExistentes.filter((_, i) => i !== idx),
    }))
  }

  const removerNova = (idx: number) => {
    setForm((prev) => {
      const preview = prev.fotosNovasPreview[idx]
      if (preview) URL.revokeObjectURL(preview)
      return {
        ...prev,
        fotosNovas: prev.fotosNovas.filter((_, i) => i !== idx),
        fotosNovasPreview: prev.fotosNovasPreview.filter((_, i) => i !== idx),
      }
    })
    if (fotoRejeitadaIndice != null) {
      if (fotoRejeitadaIndice === idx) {
        setFotoRejeitadaIndice(null)
        setErroForm(null)
      } else if (idx < fotoRejeitadaIndice) {
        setFotoRejeitadaIndice(fotoRejeitadaIndice - 1)
      }
    }
  }

  const salvarForm = async () => {
    const msg = validarFormPublicidadeExterna({
      titulo: form.titulo,
      descricao: form.descricao,
      totalFotos,
    })
    if (msg) {
      setFotoRejeitadaIndice(null)
      setErroForm(msg)
      return
    }
    if (!podeEditar) return

    setSalvando(true)
    setErroForm(null)
    setFotoRejeitadaIndice(null)
    try {
      const cardId = form.id ?? crypto.randomUUID()
      let fotos = [...form.fotosExistentes]
      if (form.fotosNovas.length > 0) {
        const novas = await uploadFotosPublicidadeExterna(supabase, cardId, form.fotosNovas)
        fotos = [...fotos, ...novas]
      }
      if (fotos.length < 1 || fotos.length > PUBLICIDADE_EXTERNA_FOTOS_MAX) {
        throw new Error(`Envie entre 1 e ${PUBLICIDADE_EXTERNA_FOTOS_MAX} fotos.`)
      }

      const payload = {
        id: cardId,
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim(),
        fotos,
        updated_at: new Date().toISOString(),
      }

      if (form.id) {
        const { error } = await supabase
          .from('publicidade_externa_cards')
          .update(payload)
          .eq('id', form.id)
        if (error) throw error
      } else {
        const maxOrdem = cards.reduce((m, c) => Math.max(m, c.ordem), -1)
        const { error } = await supabase.from('publicidade_externa_cards').insert({
          ...payload,
          ordem: maxOrdem + 1,
        })
        if (error) throw error
      }

      fecharForm()
      onMensagem({ tipo: 'sucesso', texto: 'Card salvo com sucesso!' })
      window.setTimeout(() => onMensagem(null), 3000)
      await carregar()
    } catch (e) {
      setFotoRejeitadaIndice(indiceFotoRejeitada(e))
      setErroForm(normalizarErroCadastroEmpresa(e, 'Não foi possível salvar o card.'))
    } finally {
      setSalvando(false)
    }
  }

  const excluir = async (card: PublicidadeExternaCard) => {
    if (!podeEditar) return
    if (!window.confirm(`Excluir o card "${card.titulo}"?`)) return
    try {
      const { error } = await supabase.from('publicidade_externa_cards').delete().eq('id', card.id)
      if (error) throw error
      if (form.id === card.id) fecharForm()
      onMensagem({ tipo: 'sucesso', texto: 'Card excluído.' })
      window.setTimeout(() => onMensagem(null), 3000)
      await carregar()
    } catch (e) {
      onMensagem({
        tipo: 'erro',
        texto: e instanceof Error ? e.message : 'Não foi possível excluir.',
      })
    }
  }

  const salvarWhatsapp = async () => {
    if (!podeEditar) return
    setSalvandoWa(true)
    try {
      await salvarWhatsappPublicidadeExterna(supabase, whatsapp)
      onMensagem({ tipo: 'sucesso', texto: 'WhatsApp salvo!' })
      window.setTimeout(() => onMensagem(null), 3000)
    } catch (e) {
      onMensagem({
        tipo: 'erro',
        texto: e instanceof Error ? e.message : 'Erro ao salvar WhatsApp.',
      })
    } finally {
      setSalvandoWa(false)
    }
  }

  const onDropCard = async (targetId: string) => {
    if (!dragId || dragId === targetId || !podeEditar) {
      setDragId(null)
      return
    }
    const from = cards.findIndex((c) => c.id === dragId)
    const to = cards.findIndex((c) => c.id === targetId)
    setDragId(null)
    if (from < 0 || to < 0) return
    const next = [...cards]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setCards(next)
    try {
      await salvarOrdemCardsPublicidadeExterna(
        supabase,
        next.map((c) => c.id),
      )
    } catch (e) {
      onMensagem({
        tipo: 'erro',
        texto: e instanceof Error ? e.message : 'Erro ao reordenar.',
      })
      await carregar()
    }
  }

  if (carregando) {
    return <p className="text-sm text-gray-500">Carregando catálogo…</p>
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
          WhatsApp (global — rodapé do drawer empresa)
          <input
            type="text"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            disabled={!podeEditar}
            placeholder="Ex: 5511999999999"
            className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#0097b2] disabled:opacity-60"
          />
        </label>
        {podeEditar ? (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => void salvarWhatsapp()}
              disabled={salvandoWa}
              className="rounded-xl bg-[#0097b2] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {salvandoWa ? 'Salvando…' : 'Salvar WhatsApp'}
            </button>
          </div>
        ) : null}
      </div>

      {podeEditar ? (
        <button
          type="button"
          onClick={abrirNovo}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0097b2] px-4 py-3 text-sm font-bold text-white shadow-sm hover:opacity-95"
        >
          <Megaphone className="h-5 w-5 text-white" aria-hidden />
          CRIAR
        </button>
      ) : null}

      {formAberto ? (
        <div className="space-y-3 rounded-xl border border-[#0097b2]/30 bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-[#0097b2]">
              {form.id ? 'Editar card' : 'Novo card'}
            </h4>
            <button
              type="button"
              onClick={fecharForm}
              className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
              aria-label="Fechar formulário"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Título ({form.titulo.length}/{PUBLICIDADE_EXTERNA_TITULO_MAX})
            <input
              type="text"
              maxLength={PUBLICIDADE_EXTERNA_TITULO_MAX}
              value={form.titulo}
              onChange={(e) => setForm((p) => ({ ...p, titulo: e.target.value }))}
              className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#0097b2]"
              placeholder="Até 30 caracteres"
            />
          </label>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Fotos ({totalFotos}/{PUBLICIDADE_EXTERNA_FOTOS_MAX} — mín. 1)
            </p>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {form.fotosExistentes.map((url, idx) => (
                <div
                  key={`ex-${url}-${idx}`}
                  className="relative aspect-square overflow-hidden rounded-lg bg-gray-100"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removerExistente(idx)}
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
                    aria-label="Remover foto"
                  >
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                </div>
              ))}
              {form.fotosNovasPreview.map((url, idx) => (
                <div
                  key={`new-${idx}`}
                  className={`relative aspect-square overflow-hidden rounded-lg bg-gray-100 ${
                    fotoRejeitadaIndice === idx ? CLS_FOTO_REJEITADA : ''
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removerNova(idx)}
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
                    aria-label="Remover foto"
                  >
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                </div>
              ))}
              {totalFotos < PUBLICIDADE_EXTERNA_FOTOS_MAX ? (
                <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-gray-500 hover:border-[#0097b2] hover:text-[#0097b2]">
                  <Plus className="h-6 w-6" aria-hidden />
                  <span className="mt-1 text-[10px] font-semibold">Adicionar</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      adicionarFotos(e.target.files)
                      e.target.value = ''
                    }}
                  />
                </label>
              ) : null}
            </div>
          </div>

          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Descrição ({form.descricao.length}/{PUBLICIDADE_EXTERNA_DESC_MAX})
            <textarea
              maxLength={PUBLICIDADE_EXTERNA_DESC_MAX}
              value={form.descricao}
              onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))}
              rows={4}
              className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#0097b2]"
              placeholder="Até 750 caracteres"
            />
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={fecharForm}
              className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void salvarForm()}
              disabled={salvando || !podeEditar}
              className="flex-1 rounded-xl bg-[#0097b2] py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
          {erroForm ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {erroForm}
            </div>
          ) : null}
        </div>
      ) : null}

      {cards.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhum card cadastrado ainda.</p>
      ) : (
        <ul className="space-y-2">
          {cards.map((card) => (
            <li
              key={card.id}
              draggable={podeEditar}
              onDragStart={() => setDragId(card.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => void onDropCard(card.id)}
              className={`flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-3 ${
                dragId === card.id ? 'opacity-60' : ''
              }`}
            >
              {podeEditar ? (
                <span className="cursor-grab text-gray-400 active:cursor-grabbing" aria-hidden>
                  <GripVertical className="h-5 w-5" />
                </span>
              ) : null}
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                {card.fotos[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={card.fotos[0]} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900">{card.titulo}</p>
                <p className="truncate text-xs text-gray-500">
                  {card.fotos.length} foto{card.fotos.length === 1 ? '' : 's'}
                </p>
              </div>
              {podeEditar ? (
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => abrirEditar(card)}
                    className="rounded-lg p-2 text-[#0097b2] hover:bg-[#0097b2]/10"
                    aria-label="Editar"
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => void excluir(card)}
                    className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"
                    aria-label="Excluir"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
