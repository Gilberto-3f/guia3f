'use client'

import { useRef } from 'react'
import { ImagePlus, Save, X } from 'lucide-react'
import {
  COR_AZUL_LOGO,
  COR_VERDE_BOTAO,
  DESCRICAO_PRATO_MAX,
  FOTOS_MAX,
  FOTOS_MIN,
  NOME_PRATO_MAX,
  type PratoCardapioRow,
} from '@/lib/cardapioCatalogo'
import type { CotacaoMap } from '@/lib/comprasCdeHub'
import {
  labelValorFormProduto,
  formatarPrecoMoedaPadrao,
  usdParaMoedaPadrao,
  type MoedaPadraoLoja,
} from '@/lib/comprasCdeMoedaPadrao'

export type FormPratoState = {
  id: string | null
  nome: string
  preco_usd: string
  lancarOferta: boolean
  percentual_desconto: string
  /** Texto livre da sessão (ex.: MASSAS) — resolve/cria em cardapio_categorias. */
  categoria: string
  descricao: string
  site_url: string
  fotosExistentes: string[]
  fotosNovas: File[]
  fotosNovasPreview: string[]
}

export function formPratoVazio(): FormPratoState {
  return {
    id: null,
    nome: '',
    preco_usd: '',
    lancarOferta: false,
    percentual_desconto: '',
    categoria: '',
    descricao: '',
    site_url: '',
    fotosExistentes: [],
    fotosNovas: [],
    fotosNovasPreview: [],
  }
}

export function formPratoFromRow(
  row: PratoCardapioRow,
  moedaPadrao: MoedaPadraoLoja = 'USD',
  cotacoes?: CotacaoMap,
): FormPratoState {
  const pct = Number(row.percentual_desconto) || 0
  const precoExibicao =
    moedaPadrao === 'USD' || !cotacoes
      ? row.preco_usd
      : usdParaMoedaPadrao(row.preco_usd, moedaPadrao, cotacoes)
  const precoStr =
    precoExibicao > 0
      ? String(moedaPadrao === 'PYG' ? Math.round(precoExibicao) : Number(precoExibicao.toFixed(2)))
      : ''
  return {
    id: row.id,
    nome: row.nome,
    preco_usd: precoStr,
    lancarOferta: pct > 0,
    percentual_desconto: pct > 0 ? String(pct) : '',
    categoria: row.categoria_nome ?? '',
    descricao: row.descricao ?? '',
    site_url: row.site_url ?? '',
    fotosExistentes: [...row.fotos],
    fotosNovas: [],
    fotosNovasPreview: [],
  }
}

export function validarFormPrato(form: FormPratoState): string | null {
  const nome = form.nome.trim()
  if (!nome) return 'Informe o nome do prato.'
  if (nome.length > NOME_PRATO_MAX) {
    return `O nome do prato pode ter no máximo ${NOME_PRATO_MAX} caracteres.`
  }
  const preco = Number(form.preco_usd.replace(',', '.'))
  if (!Number.isFinite(preco) || preco <= 0) return 'Informe o valor (maior que zero).'
  if (form.lancarOferta) {
    const pct = Number(form.percentual_desconto.replace(',', '.'))
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
      return 'Informe o percentual de desconto (1 a 100).'
    }
  }
  if (!form.categoria.trim()) return 'Informe a categoria (sessão) do cardápio.'
  if (form.descricao.length > DESCRICAO_PRATO_MAX) {
    return `A descrição pode ter no máximo ${DESCRICAO_PRATO_MAX} caracteres.`
  }
  const site = form.site_url.trim()
  if (site) {
    try {
      // eslint-disable-next-line no-new
      new URL(site.startsWith('http') ? site : `https://${site}`)
    } catch {
      return 'Informe um link válido em Ver no Site.'
    }
  }
  const totalFotos = form.fotosExistentes.length + form.fotosNovas.length
  if (totalFotos < FOTOS_MIN) return `Envie no mínimo ${FOTOS_MIN} foto.`
  if (totalFotos > FOTOS_MAX) return `No máximo ${FOTOS_MAX} fotos.`
  return null
}

type Props = {
  form: FormPratoState
  onChange: (next: FormPratoState) => void
  onSalvar: () => void
  onCancelar: () => void
  salvando?: boolean
  titulo: string
  erro?: string | null
  moedaPadrao?: MoedaPadraoLoja
}

export default function FormPrato({
  form,
  onChange,
  onSalvar,
  onCancelar,
  salvando = false,
  titulo,
  erro = null,
  moedaPadrao = 'USD',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const totalFotos = form.fotosExistentes.length + form.fotosNovas.length
  const podeAddFoto = totalFotos < FOTOS_MAX

  const precoCheio = Number(String(form.preco_usd).replace(',', '.'))
  const temPrecoValido = Number.isFinite(precoCheio) && precoCheio > 0
  const pctOferta = Number(String(form.percentual_desconto).replace(',', '.'))
  const valorReajustado =
    temPrecoValido &&
    form.lancarOferta &&
    Number.isFinite(pctOferta) &&
    pctOferta > 0 &&
    pctOferta <= 100
      ? Math.round(precoCheio * (1 - pctOferta / 100) * 100) / 100
      : null

  const inputCls =
    'mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#0097b2]'
  const labelCls = 'block text-xs font-semibold uppercase tracking-wide text-gray-500'

  const addFotos = (files: FileList | null) => {
    if (!files?.length) return
    const room = FOTOS_MAX - totalFotos
    const chosen = Array.from(files).slice(0, room)
    if (!chosen.length) return
    const previews = chosen.map((f) => URL.createObjectURL(f))
    onChange({
      ...form,
      fotosNovas: [...form.fotosNovas, ...chosen],
      fotosNovasPreview: [...form.fotosNovasPreview, ...previews],
    })
  }

  const removerExistente = (idx: number) => {
    onChange({
      ...form,
      fotosExistentes: form.fotosExistentes.filter((_, i) => i !== idx),
    })
  }

  const removerNova = (idx: number) => {
    const prev = form.fotosNovasPreview[idx]
    if (prev) URL.revokeObjectURL(prev)
    onChange({
      ...form,
      fotosNovas: form.fotosNovas.filter((_, i) => i !== idx),
      fotosNovasPreview: form.fotosNovasPreview.filter((_, i) => i !== idx),
    })
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-[#001f3f]">{titulo}</h3>
        <button
          type="button"
          onClick={onCancelar}
          className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
          aria-label="Cancelar"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <div className="space-y-4">
        <label className={labelCls}>
          Nome do Prato *
          <input
            type="text"
            value={form.nome}
            onChange={(e) => onChange({ ...form, nome: e.target.value.slice(0, NOME_PRATO_MAX) })}
            className={inputCls}
            maxLength={NOME_PRATO_MAX}
          />
          <span className="mt-1 block text-right text-[10px] text-gray-400">
            {form.nome.length}/{NOME_PRATO_MAX}
          </span>
        </label>

        <div>
          <p className={labelCls}>
            Foto * ({totalFotos}/{FOTOS_MAX})
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {form.fotosExistentes.map((url, i) => (
              <div key={`ex-${i}`} className="relative h-20 w-20 overflow-hidden rounded-lg bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removerExistente(i)}
                  className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"
                  aria-label="Remover foto"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            ))}
            {form.fotosNovasPreview.map((url, i) => (
              <div key={`nova-${i}`} className="relative h-20 w-20 overflow-hidden rounded-lg bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removerNova(i)}
                  className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"
                  aria-label="Remover foto"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            ))}
            {podeAddFoto ? (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 text-[#0097b2] hover:bg-[#0097b2]/5"
              >
                <ImagePlus className="h-5 w-5" aria-hidden />
                <span className="text-[10px] font-semibold">Add</span>
              </button>
            ) : null}
          </div>
          <input
            ref={inputRef}
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
          {labelValorFormProduto(moedaPadrao)}
          <input
            type="number"
            min={0}
            step={0.01}
            value={form.preco_usd}
            onChange={(e) => {
              const next = e.target.value
              const n = Number(String(next).replace(',', '.'))
              const temPreco = Number.isFinite(n) && n > 0
              onChange({
                ...form,
                preco_usd: next,
                ...(temPreco ? {} : { lancarOferta: false, percentual_desconto: '' }),
              })
            }}
            className={inputCls}
            placeholder="0.00"
          />
        </label>

        <div className="rounded-lg border border-gray-100 bg-[#f5f5f5] p-3">
          <label
            className={`flex items-center gap-2 text-sm font-semibold ${
              temPrecoValido ? 'text-[#001f3f]' : 'cursor-not-allowed text-gray-400'
            }`}
          >
            <input
              type="checkbox"
              checked={form.lancarOferta && temPrecoValido}
              disabled={!temPrecoValido}
              onChange={(e) =>
                onChange({
                  ...form,
                  lancarOferta: e.target.checked,
                  percentual_desconto: e.target.checked ? form.percentual_desconto : '',
                })
              }
              className="h-4 w-4 accent-[#0097b2] disabled:opacity-40"
            />
            Lançar Oferta
          </label>
          {!temPrecoValido ? (
            <p className="mt-1.5 text-[11px] text-gray-500">
              Informe o valor do prato para liberar o desconto.
            </p>
          ) : null}
          {form.lancarOferta && temPrecoValido ? (
            <div className="mt-3 space-y-3">
              <label className={labelCls}>
                Desconto (%)
                <input
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  value={form.percentual_desconto}
                  onChange={(e) => onChange({ ...form, percentual_desconto: e.target.value })}
                  className={inputCls}
                  placeholder="Ex: 15"
                />
              </label>
              <label className={labelCls}>
                Valor reajustado
                <input
                  type="text"
                  readOnly
                  value={
                    valorReajustado != null
                      ? formatarPrecoMoedaPadrao(valorReajustado, moedaPadrao)
                      : '—'
                  }
                  className={`${inputCls} cursor-default bg-white font-semibold text-[#00D443]`}
                  aria-live="polite"
                />
              </label>
            </div>
          ) : null}
        </div>

        <label className={labelCls}>
          Categoria (sessão do cardápio) *
          <input
            type="text"
            value={form.categoria}
            onChange={(e) => onChange({ ...form, categoria: e.target.value })}
            className={inputCls}
            placeholder="Ex: MASSAS"
            maxLength={80}
          />
          <span className="mt-1 block text-[10px] text-gray-400">
            Agrupa os pratos nesta sessão (como pastas do cardápio).
          </span>
        </label>

        <label className={labelCls}>
          Descrição (opcional)
          <textarea
            value={form.descricao}
            onChange={(e) =>
              onChange({ ...form, descricao: e.target.value.slice(0, DESCRICAO_PRATO_MAX) })
            }
            className={`${inputCls} min-h-[88px] resize-y`}
            maxLength={DESCRICAO_PRATO_MAX}
            rows={3}
          />
          <span className="mt-1 block text-right text-[10px] text-gray-400">
            {form.descricao.length}/{DESCRICAO_PRATO_MAX}
          </span>
        </label>

        <label className={labelCls}>
          Ver no Site (opcional)
          <input
            type="url"
            value={form.site_url}
            onChange={(e) => onChange({ ...form, site_url: e.target.value })}
            className={inputCls}
            placeholder="https://"
          />
        </label>
      </div>

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={onCancelar}
          className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onSalvar}
          disabled={salvando}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-50"
          style={{ backgroundColor: COR_VERDE_BOTAO }}
        >
          <Save className="h-4 w-4" aria-hidden />
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
      {erro ? (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erro}</div>
      ) : null}
      <p className="mt-2 text-center text-[10px]" style={{ color: COR_AZUL_LOGO }}>
        * Campos obrigatórios
      </p>
    </div>
  )
}
