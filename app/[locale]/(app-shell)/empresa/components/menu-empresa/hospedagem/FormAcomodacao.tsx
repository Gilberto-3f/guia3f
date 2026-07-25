'use client'

import { useMemo, useState } from 'react'
import { Check, Plus, Save, X } from 'lucide-react'
import {
  CATEGORIAS_IMOVEL,
  CATEGORIAS_PARTICULAR,
  COMODIDADES_EXTRAS_LISTA,
  COMODIDADES_PADRAO_CAMPOS,
  COR_AZUL_LOGO,
  COR_VERDE_BOTAO,
  ITENS_PARTICULARES,
  OPCOES_COMPARTILHADA,
  REFEICOES_EXTRAS,
  comodidadesExtrasVazio,
  comodidadesPadraoVazio,
  tipoCategoriaImovel,
  validarComodidadesPadrao,
  type ComodidadesExtras,
  type ComodidadesPadrao,
  type HospedagemAcomodacaoRow,
} from '@/lib/hospedagemAcomodacoesCatalogo'
import ChevronPasta from './ChevronPasta'

export type FormAcomodacaoState = {
  id: string | null
  categoria_imovel: string
  categoria_particular: string
  opcao_compartilhada: string
  capacidade_pessoas: string
  valor_diaria: string
  site_url: string
  fotosExistentes: string[]
  fotosNovas: File[]
  fotosNovasPreview: string[]
  comodidades_padrao: ComodidadesPadrao
  comodidades_extras: ComodidadesExtras
}

export function formAcomodacaoVazio(): FormAcomodacaoState {
  return {
    id: null,
    categoria_imovel: '',
    categoria_particular: '',
    opcao_compartilhada: '',
    capacidade_pessoas: '',
    valor_diaria: '',
    site_url: '',
    fotosExistentes: [],
    fotosNovas: [],
    fotosNovasPreview: [],
    comodidades_padrao: comodidadesPadraoVazio(),
    comodidades_extras: comodidadesExtrasVazio(),
  }
}

export function formFromRow(row: HospedagemAcomodacaoRow): FormAcomodacaoState {
  return {
    id: row.id,
    categoria_imovel: row.categoria_imovel,
    categoria_particular: row.categoria_particular ?? '',
    opcao_compartilhada: row.opcao_compartilhada ?? '',
    capacidade_pessoas: String(row.capacidade_pessoas),
    valor_diaria: String(row.valor_diaria),
    site_url: row.site_url ?? '',
    fotosExistentes: [...(row.fotos ?? [])],
    fotosNovas: [],
    fotosNovasPreview: [],
    comodidades_padrao: { ...row.comodidades_padrao },
    comodidades_extras: {
      selecionados: [...row.comodidades_extras.selecionados],
      itens_particulares: [...row.comodidades_extras.itens_particulares],
      refeicoes_extras: [...row.comodidades_extras.refeicoes_extras],
      outros: row.comodidades_extras.outros ?? '',
    },
  }
}

/** Duplica comodidades (e demais campos editáveis) para nova acomodação. */
export function formDuplicarDe(row: HospedagemAcomodacaoRow): FormAcomodacaoState {
  const base = formFromRow(row)
  return {
    ...base,
    id: null,
    fotosExistentes: [...row.fotos],
    fotosNovas: [],
    fotosNovasPreview: [],
  }
}

export function validarFormAcomodacao(form: FormAcomodacaoState): string | null {
  if (!form.categoria_imovel) return 'Selecione a categoria do imóvel.'
  const tipo = tipoCategoriaImovel(form.categoria_imovel)
  if (tipo === 'particular' && !form.categoria_particular) {
    return 'Selecione a categoria da acomodação particular.'
  }
  if (tipo === 'compartilhado' && !form.opcao_compartilhada) {
    return 'Selecione a opção de acomodação compartilhada.'
  }
  const cap = Number(form.capacidade_pessoas)
  if (!Number.isFinite(cap) || cap < 1) return 'Informe quantas pessoas cabem nesta acomodação.'
  const valor = Number(form.valor_diaria)
  if (!Number.isFinite(valor) || valor < 0) return 'Informe o valor da diária.'
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
  if (totalFotos < 2) return 'Envie no mínimo 2 fotos da acomodação.'
  if (totalFotos > 5) return 'Máximo de 5 fotos por acomodação.'
  const errPadrao = validarComodidadesPadrao(form.comodidades_padrao)
  if (errPadrao) return errPadrao
  if (form.comodidades_extras.outros.length > 500) {
    return 'O campo Outros deve ter no máximo 500 caracteres.'
  }
  return null
}

type Props = {
  form: FormAcomodacaoState
  onChange: (next: FormAcomodacaoState) => void
  onSalvar: () => void
  onCancelar: () => void
  salvando: boolean
  titulo?: string
  erro?: string | null
}

function RadioLista({
  opcoes,
  value,
  onChange,
}: {
  opcoes: ReadonlyArray<{ value: string; label: string }>
  value: string
  onChange: (v: string) => void
}) {
  return (
    <ul className="space-y-2">
      {opcoes.map((op) => {
        const ativo = value === op.value
        return (
          <li key={op.value}>
            <button
              type="button"
              onClick={() => onChange(op.value)}
              className={`flex w-full items-start gap-2 rounded-lg border px-3 py-2.5 text-left text-sm ${
                ativo
                  ? 'border-[#0097b2] bg-[#0097b2]/10 text-[#001f3f]'
                  : 'border-gray-200 bg-white text-gray-700'
              }`}
            >
              <span
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                  ativo ? 'border-[#0097b2] bg-[#0097b2]' : 'border-gray-300'
                }`}
              >
                {ativo ? <Check className="h-2.5 w-2.5 text-white" aria-hidden /> : null}
              </span>
              <span>{op.label}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function SimNao({
  value,
  onChange,
}: {
  value: boolean | null
  onChange: (v: boolean) => void
}) {
  return (
    <div className="mt-1.5 flex gap-2">
      {[
        { v: true, label: 'Sim' },
        { v: false, label: 'Não' },
      ].map((op) => (
        <button
          key={String(op.v)}
          type="button"
          onClick={() => onChange(op.v)}
          className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${
            value === op.v
              ? 'border-[#0097b2] bg-[#0097b2] text-white'
              : 'border-gray-200 bg-white text-gray-700'
          }`}
        >
          {op.label}
        </button>
      ))}
    </div>
  )
}

function toggleInList(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value]
}

export default function FormAcomodacao({
  form,
  onChange,
  onSalvar,
  onCancelar,
  salvando,
  titulo = 'Nova acomodação',
  erro = null,
}: Props) {
  const [abertos, setAbertos] = useState({
    imovel: true,
    particular: true,
    compartilhada: true,
    diaria: true,
    fotos: true,
    padrao: true,
    extras: false,
  })

  const tipo = useMemo(() => tipoCategoriaImovel(form.categoria_imovel), [form.categoria_imovel])
  const totalFotos = form.fotosExistentes.length + form.fotosNovas.length

  const patch = (partial: Partial<FormAcomodacaoState>) => onChange({ ...form, ...partial })

  const adicionarFotos = (files: FileList | null) => {
    if (!files?.length) return
    const restantes = Math.max(0, 5 - totalFotos)
    const escolhidos = Array.from(files).slice(0, restantes)
    if (!escolhidos.length) return
    const previews = escolhidos.map((f) => URL.createObjectURL(f))
    patch({
      fotosNovas: [...form.fotosNovas, ...escolhidos],
      fotosNovasPreview: [...form.fotosNovasPreview, ...previews],
    })
  }

  const removerFotoExistente = (idx: number) => {
    patch({ fotosExistentes: form.fotosExistentes.filter((_, i) => i !== idx) })
  }

  const removerFotoNova = (idx: number) => {
    const preview = form.fotosNovasPreview[idx]
    if (preview) URL.revokeObjectURL(preview)
    patch({
      fotosNovas: form.fotosNovas.filter((_, i) => i !== idx),
      fotosNovasPreview: form.fotosNovasPreview.filter((_, i) => i !== idx),
    })
  }

  const inputCls =
    'mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#0097b2]'
  const labelCls = 'block text-xs font-semibold uppercase tracking-wide text-gray-500'

  return (
    <div className="space-y-3 rounded-xl border border-[#0097b2]/30 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-[#0097b2]">{titulo}</h3>
        <button
          type="button"
          onClick={onCancelar}
          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
          aria-label="Fechar formulário"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {erro ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erro}</div>
      ) : null}

      <ChevronPasta
        titulo="1. Categoria do Imóvel"
        aberto={abertos.imovel}
        onToggle={() => setAbertos((a) => ({ ...a, imovel: !a.imovel }))}
      >
        <RadioLista
          opcoes={CATEGORIAS_IMOVEL.map((c) => ({ value: c.value, label: c.label }))}
          value={form.categoria_imovel}
          onChange={(v) => {
            const t = tipoCategoriaImovel(v)
            patch({
              categoria_imovel: v,
              categoria_particular: t === 'particular' ? form.categoria_particular : '',
              opcao_compartilhada: t === 'compartilhado' ? form.opcao_compartilhada : '',
            })
          }}
        />
      </ChevronPasta>

      {tipo === 'particular' ? (
        <ChevronPasta
          titulo="2. Categoria das acomodações particulares"
          aberto={abertos.particular}
          onToggle={() => setAbertos((a) => ({ ...a, particular: !a.particular }))}
        >
          <RadioLista
            opcoes={CATEGORIAS_PARTICULAR.map((c) => ({ value: c.value, label: c.label }))}
            value={form.categoria_particular}
            onChange={(v) => patch({ categoria_particular: v })}
          />
        </ChevronPasta>
      ) : null}

      {tipo === 'compartilhado' ? (
        <ChevronPasta
          titulo="2. Opções de acomodações compartilhadas"
          aberto={abertos.compartilhada}
          onToggle={() => setAbertos((a) => ({ ...a, compartilhada: !a.compartilhada }))}
        >
          <RadioLista
            opcoes={OPCOES_COMPARTILHADA.map((c) => ({ value: c.value, label: c.label }))}
            value={form.opcao_compartilhada}
            onChange={(v) => patch({ opcao_compartilhada: v })}
          />
        </ChevronPasta>
      ) : null}

      <ChevronPasta
        titulo="3. Valor da diária"
        aberto={abertos.diaria}
        onToggle={() => setAbertos((a) => ({ ...a, diaria: !a.diaria }))}
      >
        <label className={labelCls}>
          Diária para até quantas pessoas?
          <input
            type="number"
            min={1}
            step={1}
            value={form.capacidade_pessoas}
            onChange={(e) => patch({ capacidade_pessoas: e.target.value })}
            className={inputCls}
            placeholder="Ex: 1"
          />
        </label>
        <label className={`${labelCls} mt-3`}>
          Valor da diária (R$)
          <input
            type="number"
            min={0}
            step={0.01}
            value={form.valor_diaria}
            onChange={(e) => patch({ valor_diaria: e.target.value })}
            className={inputCls}
            placeholder="0,00"
          />
        </label>
      </ChevronPasta>

      <ChevronPasta
        titulo={`4. Fotos (${totalFotos}/5 — mín. 2)`}
        aberto={abertos.fotos}
        onToggle={() => setAbertos((a) => ({ ...a, fotos: !a.fotos }))}
      >
        <div className="grid grid-cols-3 gap-2">
          {form.fotosExistentes.map((url, idx) => (
            <div key={`ex-${url}-${idx}`} className="relative aspect-square overflow-hidden rounded-lg bg-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removerFotoExistente(idx)}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
                aria-label="Remover foto"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </div>
          ))}
          {form.fotosNovasPreview.map((url, idx) => (
            <div key={`new-${idx}`} className="relative aspect-square overflow-hidden rounded-lg bg-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removerFotoNova(idx)}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
                aria-label="Remover foto"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </div>
          ))}
          {totalFotos < 5 ? (
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-gray-500 hover:border-[#0097b2] hover:text-[#0097b2]">
              <Plus className="h-6 w-6" aria-hidden />
              <span className="mt-1 text-[10px] font-semibold">Adicionar</span>
              <input
                type="file"
                accept="image/*"
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
      </ChevronPasta>

      <ChevronPasta
        titulo="5. Comodidades — Informações Padrão"
        aberto={abertos.padrao}
        onToggle={() => setAbertos((a) => ({ ...a, padrao: !a.padrao }))}
      >
        <div className="space-y-4">
          {COMODIDADES_PADRAO_CAMPOS.map((campo) => {
            if (campo.tipo === 'texto') {
              return (
                <label key={campo.key} className={labelCls}>
                  {campo.label}
                  <input
                    type="text"
                    value={form.comodidades_padrao.capacidade_maxima_hospedes}
                    onChange={(e) =>
                      patch({
                        comodidades_padrao: {
                          ...form.comodidades_padrao,
                          capacidade_maxima_hospedes: e.target.value,
                        },
                      })
                    }
                    className={inputCls}
                  />
                </label>
              )
            }
            if (campo.tipo === 'banheiro') {
              return (
                <div key={campo.key}>
                  <p className={labelCls}>{campo.label}</p>
                  <div className="mt-1.5 flex gap-2">
                    {(
                      [
                        { v: 'particular' as const, label: 'Particular' },
                        { v: 'compartilhado' as const, label: 'Compartilhado' },
                      ] as const
                    ).map((op) => (
                      <button
                        key={op.v}
                        type="button"
                        onClick={() =>
                          patch({
                            comodidades_padrao: { ...form.comodidades_padrao, banheiro: op.v },
                          })
                        }
                        className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${
                          form.comodidades_padrao.banheiro === op.v
                            ? 'border-[#0097b2] bg-[#0097b2] text-white'
                            : 'border-gray-200 bg-white text-gray-700'
                        }`}
                      >
                        {op.label}
                      </button>
                    ))}
                  </div>
                </div>
              )
            }
            if (campo.tipo === 'fumantes') {
              return (
                <div key={campo.key}>
                  <p className={labelCls}>{campo.label}</p>
                  <div className="mt-1.5 flex gap-2">
                    {(
                      [
                        { v: 'livre' as const, label: 'Livre' },
                        { v: 'proibido' as const, label: 'Proibido fumar' },
                      ] as const
                    ).map((op) => (
                      <button
                        key={op.v}
                        type="button"
                        onClick={() =>
                          patch({
                            comodidades_padrao: { ...form.comodidades_padrao, fumantes: op.v },
                          })
                        }
                        className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${
                          form.comodidades_padrao.fumantes === op.v
                            ? 'border-[#0097b2] bg-[#0097b2] text-white'
                            : 'border-gray-200 bg-white text-gray-700'
                        }`}
                      >
                        {op.label}
                      </button>
                    ))}
                  </div>
                </div>
              )
            }
            if (campo.tipo === 'pet') {
              return (
                <div key={campo.key}>
                  <p className={labelCls}>{campo.label}</p>
                  <SimNao
                    value={form.comodidades_padrao.pet_friendly}
                    onChange={(v) =>
                      patch({
                        comodidades_padrao: { ...form.comodidades_padrao, pet_friendly: v },
                      })
                    }
                  />
                  {form.comodidades_padrao.pet_friendly === true ? (
                    <label className={`${labelCls} mt-2`}>
                      Observação (opcional — peso do pet, etc.)
                      <input
                        type="text"
                        value={form.comodidades_padrao.pet_friendly_obs}
                        onChange={(e) =>
                          patch({
                            comodidades_padrao: {
                              ...form.comodidades_padrao,
                              pet_friendly_obs: e.target.value,
                            },
                          })
                        }
                        className={inputCls}
                      />
                    </label>
                  ) : null}
                </div>
              )
            }
            return (
              <div key={campo.key}>
                <p className={labelCls}>{campo.label}</p>
                <SimNao
                  value={form.comodidades_padrao[campo.key] as boolean | null}
                  onChange={(v) =>
                    patch({
                      comodidades_padrao: { ...form.comodidades_padrao, [campo.key]: v },
                    })
                  }
                />
              </div>
            )
          })}
        </div>
      </ChevronPasta>

      <ChevronPasta
        titulo="6. Comodidades — Informações Extras (opcional)"
        aberto={abertos.extras}
        onToggle={() => setAbertos((a) => ({ ...a, extras: !a.extras }))}
      >
        <ul className="space-y-2">
          {COMODIDADES_EXTRAS_LISTA.map((op) => {
            const ativo = form.comodidades_extras.selecionados.includes(op.value)
            return (
              <li key={op.value}>
                <button
                  type="button"
                  onClick={() =>
                    patch({
                      comodidades_extras: {
                        ...form.comodidades_extras,
                        selecionados: toggleInList(form.comodidades_extras.selecionados, op.value),
                      },
                    })
                  }
                  className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm ${
                    ativo ? 'border-[#0097b2] bg-[#0097b2]/10' : 'border-gray-200'
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded border ${
                      ativo ? 'border-[#0097b2] bg-[#0097b2]' : 'border-gray-300'
                    }`}
                  >
                    {ativo ? <Check className="h-2.5 w-2.5 text-white" aria-hidden /> : null}
                  </span>
                  {op.label}
                </button>
              </li>
            )
          })}
        </ul>

        <p className={`${labelCls} mt-4`}>Itens particulares</p>
        <ul className="mt-1.5 space-y-2">
          {ITENS_PARTICULARES.map((op) => {
            const ativo = form.comodidades_extras.itens_particulares.includes(op.value)
            return (
              <li key={op.value}>
                <button
                  type="button"
                  onClick={() =>
                    patch({
                      comodidades_extras: {
                        ...form.comodidades_extras,
                        itens_particulares: toggleInList(
                          form.comodidades_extras.itens_particulares,
                          op.value,
                        ),
                      },
                    })
                  }
                  className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm ${
                    ativo ? 'border-[#0097b2] bg-[#0097b2]/10' : 'border-gray-200'
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded border ${
                      ativo ? 'border-[#0097b2] bg-[#0097b2]' : 'border-gray-300'
                    }`}
                  >
                    {ativo ? <Check className="h-2.5 w-2.5 text-white" aria-hidden /> : null}
                  </span>
                  {op.label}
                </button>
              </li>
            )
          })}
        </ul>

        <p className={`${labelCls} mt-4`}>Refeições extras</p>
        <ul className="mt-1.5 space-y-2">
          {REFEICOES_EXTRAS.map((op) => {
            const ativo = form.comodidades_extras.refeicoes_extras.includes(op.value)
            return (
              <li key={op.value}>
                <button
                  type="button"
                  onClick={() =>
                    patch({
                      comodidades_extras: {
                        ...form.comodidades_extras,
                        refeicoes_extras: toggleInList(
                          form.comodidades_extras.refeicoes_extras,
                          op.value,
                        ),
                      },
                    })
                  }
                  className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm ${
                    ativo ? 'border-[#0097b2] bg-[#0097b2]/10' : 'border-gray-200'
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded border ${
                      ativo ? 'border-[#0097b2] bg-[#0097b2]' : 'border-gray-300'
                    }`}
                  >
                    {ativo ? <Check className="h-2.5 w-2.5 text-white" aria-hidden /> : null}
                  </span>
                  {op.label}
                </button>
              </li>
            )
          })}
        </ul>

        <label className={`${labelCls} mt-4`}>
          Outros (até 500 caracteres)
          <textarea
            value={form.comodidades_extras.outros}
            maxLength={500}
            rows={3}
            onChange={(e) =>
              patch({
                comodidades_extras: { ...form.comodidades_extras, outros: e.target.value },
              })
            }
            className={inputCls}
          />
          <span className="mt-1 block text-[10px] font-normal normal-case text-gray-400">
            {form.comodidades_extras.outros.length}/500
          </span>
        </label>
      </ChevronPasta>

      <label className={labelCls}>
        Ver no Site (opcional)
        <input
          type="url"
          value={form.site_url}
          onChange={(e) => patch({ site_url: e.target.value })}
          className={inputCls}
          placeholder="https://..."
        />
      </label>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancelar}
          className="flex-1 rounded-xl border border-gray-300 bg-white py-3 text-sm font-bold text-gray-700"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onSalvar}
          disabled={salvando}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white disabled:opacity-50"
          style={{ backgroundColor: COR_VERDE_BOTAO }}
        >
          <Save className="h-4 w-4" aria-hidden />
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
      <p className="text-center text-[10px]" style={{ color: COR_AZUL_LOGO }}>
        Novos cadastros ficam como rascunho até você tocar em PUBLICAR.
      </p>
    </div>
  )
}
