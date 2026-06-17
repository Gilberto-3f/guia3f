'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { Check, Search, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { labelStatusEmpresaDegustacao } from '@/lib/degustacaoEmpresa'
import { corPlanoHex } from '@/lib/planosEmpresaCatalogo'

export type PlanoDegustacaoResumo = {
  id: string
  titulo: string
  cor: string
}

export type EmpresaDegustacaoBusca = {
  id: string
  usuarioId: string
  nome: string
  username: string
  email: string | null
  fotoUrl: string | null
  status: string
  docsVerificado: boolean
}

async function pesquisarEmpresasDegustacao(termo: string): Promise<EmpresaDegustacaoBusca[]> {
  const q = termo.trim()
  if (q.length < 2) return []

  const idsVistos = new Set<string>()
  const resultados: EmpresaDegustacaoBusca[] = []

  const pushEmpresa = (row: Record<string, unknown>, email: string | null = null) => {
    const id = String(row.id ?? '')
    if (!id || idsVistos.has(id)) return
    idsVistos.add(id)
    const usuarioId = row.usuario_id != null ? String(row.usuario_id) : ''
    if (!usuarioId) return
    resultados.push({
      id,
      usuarioId,
      nome: String(row.nome_fantasia ?? 'Empresa'),
      username: String(row.nome_usuario ?? '').replace(/^@+/, ''),
      email,
      fotoUrl: row.foto_url != null ? String(row.foto_url) : null,
      status: String(row.status ?? 'pendente'),
      docsVerificado: Boolean(row.docs_verificado),
    })
  }

  const { data: porEmpresa } = await supabase
    .from('empresas')
    .select('id, usuario_id, nome_fantasia, nome_usuario, foto_url, status, docs_verificado')
    .or(`nome_fantasia.ilike.%${q}%,nome_usuario.ilike.%${q}%`)
    .limit(12)

  for (const row of porEmpresa ?? []) {
    pushEmpresa(row as Record<string, unknown>)
  }

  const { data: porEmail } = await supabase
    .from('usuarios')
    .select('id, email')
    .eq('role', 'empresa')
    .ilike('email', `%${q}%`)
    .limit(8)

  const uids = (porEmail ?? []).map((u) => String((u as { id: string }).id)).filter(Boolean)
  if (uids.length > 0) {
    const { data: empPorUid } = await supabase
      .from('empresas')
      .select('id, usuario_id, nome_fantasia, nome_usuario, foto_url, status, docs_verificado')
      .in('usuario_id', uids)

    for (const row of empPorUid ?? []) {
      const r = row as Record<string, unknown>
      const uid = String(r.usuario_id ?? '')
      const emailRow = (porEmail ?? []).find((u) => String((u as { id: string }).id) === uid) as
        | { email?: string | null }
        | undefined
      pushEmpresa(r, emailRow?.email != null ? String(emailRow.email) : null)
    }
  }

  return resultados
}

export function ModalDegustacao({
  aberto,
  plano,
  onFechar,
}: {
  aberto: boolean
  plano: PlanoDegustacaoResumo | null
  onFechar: () => void
}) {
  const [busca, setBusca] = useState('')
  const [pesquisando, setPesquisando] = useState(false)
  const [resultados, setResultados] = useState<EmpresaDegustacaoBusca[]>([])
  const [selecionada, setSelecionada] = useState<EmpresaDegustacaoBusca | null>(null)
  const [dias, setDias] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)
  const [concedendo, setConcedendo] = useState(false)

  const resetar = useCallback(() => {
    setBusca('')
    setResultados([])
    setSelecionada(null)
    setDias('')
    setErro(null)
    setSucesso(null)
  }, [])

  useEffect(() => {
    if (!aberto) resetar()
  }, [aberto, resetar])

  const pesquisar = async () => {
    setPesquisando(true)
    setErro(null)
    setSucesso(null)
    setSelecionada(null)
    try {
      const lista = await pesquisarEmpresasDegustacao(busca)
      setResultados(lista)
      if (lista.length === 1) setSelecionada(lista[0])
      if (lista.length === 0) setErro('Nenhuma empresa encontrada.')
    } catch {
      setErro('Não foi possível pesquisar.')
      setResultados([])
    } finally {
      setPesquisando(false)
    }
  }

  const conceder = async () => {
    if (!plano?.id) {
      setErro('Plano não identificado. Feche e abra a degustação pelo card do plano desejado.')
      return
    }
    if (!selecionada) {
      setErro('Selecione uma empresa.')
      return
    }
    const diasNum = Math.floor(Number(dias))
    if (!Number.isFinite(diasNum) || diasNum < 1) {
      setErro('Informe a quantidade de dias (mínimo 1).')
      return
    }

    setConcedendo(true)
    setErro(null)
    setSucesso(null)
    try {
      const res = await fetch('/api/admin/degustacao-empresa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa_id: selecionada.id,
          empresa_usuario_id: selecionada.usuarioId,
          username: selecionada.username,
          plano_id: plano.id,
          dias: diasNum,
        }),
      })
      const json = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !json.ok) {
        setErro(json.error ?? 'Não foi possível conceder a degustação.')
        return
      }
      setSucesso(`Degustação de ${diasNum} dias do plano ${plano.titulo} enviada para ${selecionada.nome}.`)
      setDias('')
    } catch {
      setErro('Erro de rede ao conceder degustação.')
    } finally {
      setConcedendo(false)
    }
  }

  if (!aberto) return null

  const statusLabel = selecionada
    ? labelStatusEmpresaDegustacao(selecionada.status, selecionada.docsVerificado)
    : ''
  const statusCls =
    statusLabel === 'Verificado'
      ? 'text-[#00D443] font-semibold'
      : statusLabel === 'Recusado'
        ? 'text-rose-600 font-semibold'
        : 'text-amber-600 font-semibold'

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/50" onClick={onFechar} aria-label="Fechar" />
      <div
        role="dialog"
        aria-labelledby="degustacao-titulo"
        className="relative z-10 w-full max-w-lg rounded-2xl bg-[#0097b2] p-4 shadow-2xl sm:p-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 id="degustacao-titulo" className="text-lg font-bold text-white">
              Degustação
            </h2>
            {plano ? (
              <p className="mt-0.5 text-sm text-white/90">
                Plano:{' '}
                <span
                  className="inline-flex rounded-md px-1.5 py-0.5 font-semibold text-white"
                  style={{ backgroundColor: corPlanoHex(plano.cor) }}
                >
                  {plano.titulo}
                </span>
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-amber-100">Selecione um plano no card antes de conceder.</p>
            )}
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="rounded-lg p-1 text-white/90 hover:bg-white/15"
            aria-label="Fechar popup"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void pesquisar()
          }}
          placeholder="Nome social, @username ou e-mail"
          className="w-full rounded-xl border-2 border-white/30 bg-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white/70 outline-none focus:border-white"
        />

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => void pesquisar()}
            disabled={pesquisando || busca.trim().length < 2}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-white bg-[#00D443] py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            <Search className="h-4 w-4" aria-hidden />
            {pesquisando ? 'Pesquisando…' : 'PESQUISAR'}
          </button>
          <button
            type="button"
            onClick={onFechar}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-white bg-rose-600 py-2.5 text-sm font-bold text-white"
          >
            <X className="h-4 w-4" aria-hidden />
            CANCELAR
          </button>
        </div>

        {resultados.length > 1 ? (
          <div className="mt-3 max-h-36 space-y-1 overflow-y-auto rounded-xl bg-white/10 p-2">
            {resultados.map((emp) => (
              <button
                key={emp.id}
                type="button"
                onClick={() => setSelecionada(emp)}
                className={`w-full rounded-lg px-2 py-1.5 text-left text-xs text-white ${
                  selecionada?.id === emp.id ? 'bg-white/25' : 'hover:bg-white/15'
                }`}
              >
                {emp.nome} · @{emp.username}
              </button>
            ))}
          </div>
        ) : null}

        {selecionada ? (
          <div className="mt-4 rounded-xl bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-gray-100">
                {selecionada.fotoUrl ? (
                  <Image src={selecionada.fotoUrl} alt="" fill className="object-cover" sizes="56px" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-2xl" aria-hidden>
                    🏢
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-gray-900">{selecionada.nome}</p>
                <p className="text-sm text-gray-600">@{selecionada.username}</p>
                {selecionada.email ? <p className="truncate text-xs text-gray-500">{selecionada.email}</p> : null}
                <p className={`mt-1 text-xs ${statusCls}`}>Status: {statusLabel}</p>
              </div>
            </div>

            <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Período (dias)
              <input
                type="number"
                min={1}
                max={365}
                value={dias}
                onChange={(e) => setDias(e.target.value)}
                placeholder="Ex.: 7"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#0097b2]"
              />
            </label>

            <button
              type="button"
              onClick={() => void conceder()}
              disabled={concedendo || !plano?.id}
              className="mt-3 w-full rounded-xl bg-[#0097b2] py-3 text-sm font-bold uppercase tracking-wide text-white disabled:opacity-50"
            >
              {concedendo ? 'Enviando…' : 'CONCEDER!'}
            </button>
          </div>
        ) : null}

        {erro ? <p className="mt-3 text-sm text-rose-100">{erro}</p> : null}
        {sucesso ? <p className="mt-3 text-sm text-emerald-100">{sucesso}</p> : null}
      </div>
    </div>
  )
}
