'use client'

import { useRef } from 'react'
import { Save, X, ImagePlus } from 'lucide-react'
import {
  COR_AZUL_LOGO,
  COR_VERDE_BOTAO,
  DESCRICAO_MAX,
  FOTOS_MAX,
  FOTOS_MIN,
  type AtrativoExperienciaRow,
} from '@/lib/atrativosCatalogo'

export type FormAtrativoState = {
  id: string | null
  titulo: string
  descricao: string
  oferece_inteira: boolean
  preco_inteira: string
  oferece_meia: boolean
  preco_meia: string
  fotosExistentes: string[]
  fotosNovas: File[]
  fotosNovasPreview: string[]
}

export function formAtrativoVazio(): FormAtrativoState {
  return {
    id: null,
    titulo: '',
    descricao: '',
    oferece_inteira: true,
    preco_inteira: '',
    oferece_meia: false,
    preco_meia: '',
    fotosExistentes: [],
    fotosNovas: [],
    fotosNovasPreview: [],
  }
}

export function formFromRow(row: AtrativoExperienciaRow): FormAtrativoState {
  return {
    id: row.id,
    titulo: row.titulo,
    descricao: row.descricao,
    oferece_inteira: row.oferece_inteira,
    preco_inteira: row.preco_inteira != null ? String(row.preco_inteira) : '',
    oferece_meia: row.oferece_meia,
    preco_meia: row.preco_meia != null ? String(row.preco_meia) : '',
    fotosExistentes: [...row.fotos],
    fotosNovas: [],
    fotosNovasPreview: [],
  }
}

export function formDuplicarDe(row: AtrativoExperienciaRow): FormAtrativoState {
  return {
    ...formFromRow(row),
    id: null,
    titulo: `${row.titulo} (cópia)`,
    fotosExistentes: [...row.fotos],
    fotosNovas: [],
    fotosNovasPreview: [],
  }
}

export function validarFormAtrativo(form: FormAtrativoState): string | null {
  if (!form.titulo.trim()) return 'Informe o título do mini-card.'
  if (form.descricao.length > DESCRICAO_MAX) {
    return `A descrição pode ter no máximo ${DESCRICAO_MAX} caracteres.`
  }
  if (!form.oferece_inteira && !form.oferece_meia) {
    return 'Selecione ao menos um tipo de ticket (inteira ou meia).'
  }
  if (form.oferece_inteira) {
    const n = Number(form.preco_inteira)
    if (!Number.isFinite(n) || n < 0) return 'Informe o valor do ticket inteira.'
  }
  if (form.oferece_meia) {
    const n = Number(form.preco_meia)
    if (!Number.isFinite(n) || n < 0) return 'Informe o valor do ticket meia-entrada.'
  }
  const totalFotos = form.fotosExistentes.length + form.fotosNovas.length
  if (totalFotos < FOTOS_MIN) return `Envie no mínimo ${FOTOS_MIN} foto.`
  if (totalFotos > FOTOS_MAX) return `No máximo ${FOTOS_MAX} fotos.`
  return null
}

type Props = {
  form: FormAtrativoState
  onChange: (next: FormAtrativoState) => void
  onSalvar: () => void
  onCancelar: () => void
  salvando?: boolean
  titulo: string
}

export default function FormAtrativo({
  form,
  onChange,
  onSalvar,
  onCancelar,
  salvando = false,
  titulo,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const totalFotos = form.fotosExistentes.length + form.fotosNovas.length
  const podeAddFoto = totalFotos < FOTOS_MAX

  const patch = (partial: Partial<FormAtrativoState>) => onChange({ ...form, ...partial })

  const addFotos = (files: FileList | null) => {
    if (!files?.length) return
    const restam = FOTOS_MAX - totalFotos
    const selecionados = Array.from(files).slice(0, restam)
    if (!selecionados.length) return
    const previews = selecionados.map((f) => URL.createObjectURL(f))
    patch({
      fotosNovas: [...form.fotosNovas, ...selecionados],
      fotosNovasPreview: [...form.fotosNovasPreview, ...previews],
    })
  }

  const removerExistente = (idx: number) => {
    patch({ fotosExistentes: form.fotosExistentes.filter((_, i) => i !== idx) })
  }

  const removerNova = (idx: number) => {
    const url = form.fotosNovasPreview[idx]
    if (url) URL.revokeObjectURL(url)
    patch({
      fotosNovas: form.fotosNovas.filter((_, i) => i !== idx),
      fotosNovasPreview: form.fotosNovasPreview.filter((_, i) => i !== idx),
    })
  }

  const inputCls =
    'mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#0097b2]'
  const labelCls = 'block text-xs font-semibold uppercase tracking-wide text-gray-500'

  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-[#f5f5f5] p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-[#0097b2]">{titulo}</h3>
        <button
          type="button"
          onClick={onCancelar}
          className="rounded-full p-1.5 text-gray-500 hover:bg-white"
          aria-label="Cancelar"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <label className={labelCls}>
        Título do mini-card
        <input
          type="text"
          value={form.titulo}
          onChange={(e) => patch({ titulo: e.target.value })}
          className={inputCls}
          maxLength={120}
          placeholder="Ex.: Cataratas — passeio completo"
        />
      </label>

      <div>
        <p className={labelCls}>
          Fotos ({totalFotos}/{FOTOS_MAX}) — mín. {FOTOS_MIN}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {form.fotosExistentes.map((url, i) => (
            <div key={`e-${url}-${i}`} className="relative h-20 w-20 overflow-hidden rounded-lg bg-gray-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removerExistente(i)}
                className="absolute right-0.5 top-0.5 rounded bg-black/60 px-1 text-[10px] text-white"
              >
                ×
              </button>
            </div>
          ))}
          {form.fotosNovasPreview.map((url, i) => (
            <div key={`n-${i}`} className="relative h-20 w-20 overflow-hidden rounded-lg bg-gray-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removerNova(i)}
                className="absolute right-0.5 top-0.5 rounded bg-black/60 px-1 text-[10px] text-white"
              >
                ×
              </button>
            </div>
          ))}
          {podeAddFoto ? (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 bg-white text-gray-500"
            >
              <ImagePlus className="h-5 w-5" aria-hidden />
              <span className="text-[10px]">Add</span>
            </button>
          ) : null}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            addFotos(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      <label className={labelCls}>
        Descrição ({form.descricao.length}/{DESCRICAO_MAX})
        <textarea
          rows={3}
          value={form.descricao}
          onChange={(e) => patch({ descricao: e.target.value.slice(0, DESCRICAO_MAX) })}
          className={inputCls}
          placeholder="Descreva a experiência"
        />
      </label>

      <div>
        <p className={labelCls}>Valor do ticket</p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => patch({ oferece_inteira: !form.oferece_inteira })}
            className={`flex-1 rounded-lg border py-2.5 text-sm font-semibold ${
              form.oferece_inteira
                ? 'border-[#0097b2] bg-[#0097b2] text-white'
                : 'border-gray-200 bg-white text-gray-700'
            }`}
          >
            Inteira
          </button>
          <button
            type="button"
            onClick={() => patch({ oferece_meia: !form.oferece_meia })}
            className={`flex-1 rounded-lg border py-2.5 text-sm font-semibold ${
              form.oferece_meia
                ? 'border-[#0097b2] bg-[#0097b2] text-white'
                : 'border-gray-200 bg-white text-gray-700'
            }`}
          >
            Meia entrada
          </button>
        </div>
        {form.oferece_inteira ? (
          <label className={`${labelCls} mt-2`}>
            Preço inteira (R$)
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.preco_inteira}
              onChange={(e) => patch({ preco_inteira: e.target.value })}
              className={inputCls}
            />
          </label>
        ) : null}
        {form.oferece_meia ? (
          <label className={`${labelCls} mt-2`}>
            Preço meia (R$)
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.preco_meia}
              onChange={(e) => patch({ preco_meia: e.target.value })}
              className={inputCls}
            />
          </label>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onSalvar}
        disabled={salvando}
        className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white disabled:opacity-50"
        style={{ backgroundColor: COR_VERDE_BOTAO }}
      >
        <Save className="h-4 w-4" aria-hidden />
        {salvando ? 'Salvando…' : 'Salvar'}
      </button>
      <p className="text-center text-[11px] text-gray-400" style={{ color: COR_AZUL_LOGO }}>
        Após salvar, use Editar / Replicar / Excluir no card abaixo.
      </p>
    </div>
  )
}
