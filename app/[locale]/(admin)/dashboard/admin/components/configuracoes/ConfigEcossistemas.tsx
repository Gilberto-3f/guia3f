'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Star, Trash2, X } from 'lucide-react'
import {
  CIDADES_CATALOGO,
  TILE_SEXTO_OPCOES,
  slugDeNome,
  type EcossistemaBloco,
  type EcossistemaCidade,
  type EcossistemaTileSexto,
  type EcossistemaTipo,
} from '@/lib/ecossistemas'

type FormState = {
  nome: string
  tipo: EcossistemaTipo
  descricao: string
  disponivel_home: boolean
  padrao: boolean
  tile_sexto: EcossistemaTileSexto
  cidades: EcossistemaCidade[]
}

const FORM_VAZIO: FormState = {
  nome: '',
  tipo: 'cidade',
  descricao: '',
  disponivel_home: true,
  padrao: false,
  tile_sexto: 'aguarde',
  cidades: [],
}

function blocoParaForm(b: EcossistemaBloco): FormState {
  return {
    nome: b.nome,
    tipo: b.tipo,
    descricao: b.descricao ?? '',
    disponivel_home: b.disponivel_home,
    padrao: b.padrao,
    tile_sexto: b.tile_sexto,
    cidades: [...b.cidades],
  }
}

function labelTile(id: EcossistemaTileSexto) {
  return TILE_SEXTO_OPCOES.find((o) => o.id === id)?.label ?? id
}

export function ConfigEcossistemas() {
  const [lista, setLista] = useState<EcossistemaBloco[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [criando, setCriando] = useState(false)
  const [form, setForm] = useState<FormState>(FORM_VAZIO)
  const [cidadeExtra, setCidadeExtra] = useState('')
  const [salvando, setSalvando] = useState(false)

  const formAberto = criando || Boolean(editandoId)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const res = await fetch('/api/admin/ecossistemas', { credentials: 'include' })
      const json = (await res.json()) as { ok?: boolean; ecossistemas?: EcossistemaBloco[]; error?: string }
      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'Não foi possível carregar os ecossistemas.')
      }
      setLista(json.ecossistemas ?? [])
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao carregar.'
      setErro(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const fecharForm = () => {
    setCriando(false)
    setEditandoId(null)
    setForm(FORM_VAZIO)
    setCidadeExtra('')
  }

  const abrirNovo = () => {
    setEditandoId(null)
    setForm(FORM_VAZIO)
    setCidadeExtra('')
    setCriando(true)
  }

  const abrirEditar = (b: EcossistemaBloco) => {
    setCriando(false)
    setEditandoId(b.id)
    setForm(blocoParaForm(b))
    setCidadeExtra('')
  }

  const toggleCidade = (c: EcossistemaCidade) => {
    setForm((prev) => {
      const ja = prev.cidades.some((x) => x.chave.toLowerCase() === c.chave.toLowerCase())
      if (prev.tipo === 'cidade') {
        return { ...prev, cidades: ja ? [] : [c] }
      }
      if (ja) {
        return { ...prev, cidades: prev.cidades.filter((x) => x.chave.toLowerCase() !== c.chave.toLowerCase()) }
      }
      return { ...prev, cidades: [...prev.cidades, c] }
    })
  }

  const adicionarExtra = () => {
    const label = cidadeExtra.trim()
    if (!label) return
    const cidade: EcossistemaCidade = { chave: label, label, pais: null }
    toggleCidade(cidade)
    setCidadeExtra('')
  }

  const salvar = async () => {
    if (form.nome.trim().length < 2) {
      setMensagem({ tipo: 'erro', texto: 'Informe o nome do ecossistema.' })
      return
    }
    if (form.cidades.length < 1) {
      setMensagem({ tipo: 'erro', texto: 'Inclua ao menos uma cidade.' })
      return
    }
    if (form.tipo === 'cidade' && form.cidades.length > 1) {
      setMensagem({ tipo: 'erro', texto: 'Tipo cidade aceita só um município.' })
      return
    }
    setSalvando(true)
    setMensagem(null)
    try {
      const payload = {
        nome: form.nome.trim(),
        slug: slugDeNome(form.nome),
        tipo: form.tipo,
        descricao: form.descricao.trim(),
        disponivel_home: form.disponivel_home,
        padrao: form.padrao,
        tile_sexto: form.tile_sexto,
        cidades: form.cidades,
      }
      const res = editandoId
        ? await fetch(`/api/admin/ecossistemas/${editandoId}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/admin/ecossistemas', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
      const json = (await res.json()) as {
        ok?: boolean
        error?: string
        ecossistemas?: EcossistemaBloco[]
        ecossistema?: EcossistemaBloco
      }
      if (!res.ok || !json.ok) throw new Error(json.error || 'Falha ao salvar.')
      if (json.ecossistemas) {
        setLista(json.ecossistemas)
      } else if (json.ecossistema) {
        const atualizado = json.ecossistema
        setLista((prev) => {
          const i = prev.findIndex((x) => x.id === atualizado.id)
          if (i < 0) return [atualizado, ...prev]
          const next = [...prev]
          next[i] = atualizado
          return next
        })
      } else {
        await carregar()
      }
      setMensagem({ tipo: 'sucesso', texto: editandoId ? 'Ecossistema atualizado.' : 'Ecossistema criado.' })
      window.setTimeout(() => setMensagem(null), 3000)
      fecharForm()
    } catch (e) {
      setMensagem({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Erro ao salvar.' })
    } finally {
      setSalvando(false)
    }
  }

  const excluir = async (b: EcossistemaBloco) => {
    if (b.padrao) {
      setMensagem({ tipo: 'erro', texto: 'Não é possível excluir o ecossistema padrão.' })
      return
    }
    if (!window.confirm(`Excluir o ecossistema “${b.nome}”?`)) return
    setMensagem(null)
    try {
      const res = await fetch(`/api/admin/ecossistemas/${b.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const json = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !json.ok) throw new Error(json.error || 'Falha ao excluir.')
      setLista((prev) => prev.filter((x) => x.id !== b.id))
      if (editandoId === b.id) fecharForm()
      setMensagem({ tipo: 'sucesso', texto: 'Ecossistema excluído.' })
      window.setTimeout(() => setMensagem(null), 3000)
    } catch (e) {
      setMensagem({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Erro ao excluir.' })
    }
  }

  const cidadesCatalogoMarcadas = useMemo(() => {
    const set = new Set(form.cidades.map((c) => c.chave.toLowerCase()))
    return set
  }, [form.cidades])

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
        Carregando...
      </div>
    )
  }

  if (erro) {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{erro}</div>
        <p className="text-xs text-gray-500">
          Se a tabela ainda não existir, rode a migration{' '}
          <code className="rounded bg-gray-100 px-1">20261017010000_ecossistemas_blocos.sql</code> no Supabase.
        </p>
        <button
          type="button"
          onClick={() => void carregar()}
          className="rounded-xl bg-[#0097b2] px-4 py-2 text-sm font-semibold text-white"
        >
          Tentar de novo
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {mensagem ? (
        <div
          className={`rounded-xl p-3 text-sm ${
            mensagem.tipo === 'sucesso' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
          }`}
        >
          {mensagem.texto}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-[#666666]">Blocos de cidade ou região usados no chevron da home.</p>
        <button
          type="button"
          onClick={abrirNovo}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#00D443] px-3 py-2 text-sm font-bold uppercase text-white"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
          Novo
        </button>
      </div>

      {formAberto ? (
        <div className="space-y-3 rounded-2xl border border-gray-200 bg-[#f5f5f5] p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase text-[#0097b2]">
              {editandoId ? 'Editar ecossistema' : 'Novo ecossistema'}
            </h3>
            <button type="button" onClick={fecharForm} aria-label="Fechar" className="rounded-full p-1 text-gray-500 hover:bg-white">
              <X className="h-4 w-4" />
            </button>
          </div>

          <label className="block text-sm">
            <span className="font-semibold text-gray-700">Nome</span>
            <input
              type="text"
              value={form.nome}
              onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
              placeholder="Ex.: Londrina"
            />
          </label>

          <div className="flex gap-2">
            {(['cidade', 'regiao'] as EcossistemaTipo[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() =>
                  setForm((p) => ({
                    ...p,
                    tipo: t,
                    cidades: t === 'cidade' && p.cidades.length > 1 ? p.cidades.slice(0, 1) : p.cidades,
                  }))
                }
                className={[
                  'flex-1 rounded-xl py-2 text-sm font-bold uppercase',
                  form.tipo === t ? 'bg-[#0097b2] text-white' : 'bg-white text-[#0097b2] border border-gray-200',
                ].join(' ')}
              >
                {t === 'cidade' ? 'Cidade' : 'Região'}
              </button>
            ))}
          </div>

          {form.tipo === 'regiao' ? (
            <p className="text-xs text-[#666666]">
              Empresas e profissionais dessas cidades passam a ver os canais desta região. O eco cidade
              permanece na home como guia.
            </p>
          ) : null}

          <div>
            <p className="text-sm font-semibold text-gray-700">Cidades</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {CIDADES_CATALOGO.map((c) => {
                const on = cidadesCatalogoMarcadas.has(c.chave.toLowerCase())
                return (
                  <button
                    key={c.chave}
                    type="button"
                    onClick={() => toggleCidade(c)}
                    className={[
                      'rounded-full px-3 py-1 text-xs font-semibold',
                      on ? 'bg-[#0097b2] text-white' : 'bg-white text-gray-700 border border-gray-200',
                    ].join(' ')}
                  >
                    {c.label}
                  </button>
                )
              })}
            </div>
            {form.cidades
              .filter((c) => !CIDADES_CATALOGO.some((x) => x.chave.toLowerCase() === c.chave.toLowerCase()))
              .map((c) => (
                <button
                  key={c.chave}
                  type="button"
                  onClick={() => toggleCidade(c)}
                  className="mt-1.5 mr-1.5 rounded-full bg-[#0097b2] px-3 py-1 text-xs font-semibold text-white"
                >
                  {c.label} ×
                </button>
              ))}
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={cidadeExtra}
                onChange={(e) => setCidadeExtra(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    adicionarExtra()
                  }
                }}
                className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                placeholder="Outra cidade…"
              />
              <button
                type="button"
                onClick={adicionarExtra}
                className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-[#0097b2] border border-gray-200"
              >
                Incluir
              </button>
            </div>
          </div>

          <label className="block text-sm">
            <span className="font-semibold text-gray-700">6º botão da home</span>
            <select
              value={form.tile_sexto}
              onChange={(e) => setForm((p) => ({ ...p, tile_sexto: e.target.value as EcossistemaTileSexto }))}
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              {TILE_SEXTO_OPCOES.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="font-semibold text-gray-700">Descrição (opcional)</span>
            <textarea
              value={form.descricao}
              onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))}
              rows={2}
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
            />
          </label>

          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <input
              type="checkbox"
              checked={form.disponivel_home}
              onChange={(e) => setForm((p) => ({ ...p, disponivel_home: e.target.checked }))}
            />
            Disponível no chevron da home
          </label>

          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <input
              type="checkbox"
              checked={form.padrao}
              disabled={Boolean(editandoId) && form.padrao}
              onChange={(e) => setForm((p) => ({ ...p, padrao: e.target.checked }))}
            />
            Padrão (1º acesso do turista)
          </label>
          {editandoId && form.padrao ? (
            <p className="text-xs text-[#666666]">Para tirar o padrão, marque outro ecossistema como padrão.</p>
          ) : null}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={fecharForm}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-700 border border-gray-200"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void salvar()}
              disabled={salvando}
              className="rounded-xl bg-[#0097b2] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        {lista.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
            Nenhum ecossistema cadastrado.
          </div>
        ) : (
          lista.map((b) => (
            <div key={b.id} className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold text-gray-900">{b.nome}</h3>
                    {b.padrao ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold uppercase text-amber-700">
                        <Star className="h-3 w-3" fill="currentColor" />
                        Padrão
                      </span>
                    ) : null}
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold uppercase text-[#0097b2]">
                      {b.tipo === 'regiao' ? 'Região' : 'Cidade'}
                    </span>
                    {!b.disponivel_home ? (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">
                        Oculto na home
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-[#666666]">
                    {b.cidades.map((c) => c.label).join(', ') || 'Sem cidades'}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">6º botão: {labelTile(b.tile_sexto)}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => abrirEditar(b)}
                    aria-label={`Editar ${b.nome}`}
                    className="rounded-lg p-2 text-[#0097b2] hover:bg-gray-50"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void excluir(b)}
                    disabled={b.padrao}
                    aria-label={`Excluir ${b.nome}`}
                    className="rounded-lg p-2 text-rose-600 hover:bg-rose-50 disabled:opacity-30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
