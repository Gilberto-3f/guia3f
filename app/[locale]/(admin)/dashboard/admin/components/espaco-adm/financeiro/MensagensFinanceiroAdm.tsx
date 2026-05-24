'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, Send } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useSharedAdminGate } from '../../../context/AdminPermissaoContext'

type AbaDestino = 'profissional' | 'empresa'

type Destinatario = {
  usuarioId: string
  nome: string
  subtitulo: string
}

type EnvioCard = {
  id: string
  destino: AbaDestino
  nome: string
  titulo: string
  createdAt: string
}

export function MensagensFinanceiroAdm() {
  const gate = useSharedAdminGate()
  const [aba, setAba] = useState<AbaDestino>('profissional')
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<Destinatario[]>([])
  const [buscando, setBuscando] = useState(false)
  const [selecionado, setSelecionado] = useState<Destinatario | null>(null)
  const [titulo, setTitulo] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [historico, setHistorico] = useState<EnvioCard[]>([])

  const podeEnviar = gate.status === 'ok'

  const buscar = useCallback(async () => {
    const termo = busca.trim()
    if (termo.length < 2) {
      setResultados([])
      return
    }
    setBuscando(true)
    try {
      if (aba === 'profissional') {
        const { data } = await supabase
          .from('profissionais')
          .select('usuario_id, nome_completo, nome_usuario, categorias')
          .or(`nome_completo.ilike.%${termo}%,nome_usuario.ilike.%${termo}%`)
          .limit(12)

        setResultados(
          (data ?? []).map((p) => ({
            usuarioId: String(p.usuario_id),
            nome: String(p.nome_completo ?? 'Profissional'),
            subtitulo: `@${String(p.nome_usuario ?? '—')} · ${Array.isArray(p.categorias) ? p.categorias.join(', ') : ''}`,
          }))
        )
      } else {
        const { data } = await supabase
          .from('empresas')
          .select('usuario_id, nome_fantasia, nome_usuario, categoria')
          .or(`nome_fantasia.ilike.%${termo}%,nome_usuario.ilike.%${termo}%`)
          .limit(12)

        setResultados(
          (data ?? []).map((e) => ({
            usuarioId: String(e.usuario_id),
            nome: String(e.nome_fantasia ?? 'Empresa'),
            subtitulo: `@${String(e.nome_usuario ?? '—')} · ${String(e.categoria ?? '')}`,
          }))
        )
      }
    } catch (e) {
      console.error(e)
      setResultados([])
    } finally {
      setBuscando(false)
    }
  }, [aba, busca])

  useEffect(() => {
    const t = setTimeout(() => {
      void buscar()
    }, 320)
    return () => clearTimeout(t)
  }, [buscar])

  const abaCls = (ativo: boolean) =>
    `flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
      ativo ? 'bg-[#0097b2] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
    }`

  const endpoint = useMemo(
    () =>
      aba === 'profissional'
        ? '/api/admin/canal-financeiro-profissional'
        : '/api/admin/canal-financeiro-empresa',
    [aba]
  )

  const enviar = async () => {
    if (!selecionado || !titulo.trim() || !podeEnviar) return
    setEnviando(true)
    try {
      const body =
        aba === 'profissional'
          ? {
              profissional_usuario_id: selecionado.usuarioId,
              titulo: titulo.trim(),
              mensagem: mensagem.trim() || null,
              tipo: 'mensagem_adm',
            }
          : {
              empresa_usuario_id: selecionado.usuarioId,
              titulo: titulo.trim(),
              mensagem: mensagem.trim() || null,
              tipo: 'mensagem_adm',
            }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !json.ok) {
        window.alert(json.error ?? 'Não foi possível enviar a mensagem.')
        return
      }

      setHistorico((prev) => [
        {
          id: `${Date.now()}`,
          destino: aba,
          nome: selecionado.nome,
          titulo: titulo.trim(),
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ])
      setTitulo('')
      setMensagem('')
      setSelecionado(null)
      setBusca('')
      setResultados([])
    } catch (e) {
      console.error(e)
      window.alert('Erro ao enviar.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-bold text-gray-900">Canal Financeiro — mensagens direcionadas</h2>
      <p className="mt-1 text-sm text-gray-600">
        Localize um profissional ou empresa e envie comunicados particulares ao canal financeiro deles.
      </p>

      <div className="mt-4 flex gap-2" role="tablist">
        <button type="button" role="tab" aria-selected={aba === 'profissional'} className={abaCls(aba === 'profissional')} onClick={() => setAba('profissional')}>
          Profissionais
        </button>
        <button type="button" role="tab" aria-selected={aba === 'empresa'} className={abaCls(aba === 'empresa')} onClick={() => setAba('empresa')}>
          Empresas
        </button>
      </div>

      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder={aba === 'profissional' ? 'Buscar profissional por nome ou @…' : 'Buscar empresa por nome ou @…'}
          className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#0097b2] focus:ring-1 focus:ring-[#0097b2]"
        />
      </div>

      {buscando ? <p className="mt-2 text-xs text-gray-500">Buscando…</p> : null}

      {resultados.length > 0 ? (
        <ul className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-gray-100">
          {resultados.map((r) => (
            <li key={r.usuarioId}>
              <button
                type="button"
                onClick={() => setSelecionado(r)}
                className={`flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                  selecionado?.usuarioId === r.usuarioId ? 'bg-[#0097b2]/10' : ''
                }`}
              >
                <span className="font-medium text-gray-800">{r.nome}</span>
                <span className="text-xs text-gray-500">{r.subtitulo}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {selecionado ? (
        <p className="mt-3 text-sm text-gray-700">
          Destinatário: <strong>{selecionado.nome}</strong>
        </p>
      ) : (
        <p className="mt-3 text-xs text-gray-500">Selecione um destinatário na lista acima.</p>
      )}

      <input
        type="text"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        placeholder="Assunto / título da mensagem"
        className="mt-3 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#0097b2]"
      />
      <textarea
        value={mensagem}
        onChange={(e) => setMensagem(e.target.value)}
        rows={4}
        placeholder="Mensagem (opcional)"
        className="mt-2 w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#0097b2]"
      />

      <button
        type="button"
        disabled={!selecionado || !titulo.trim() || enviando || !podeEnviar}
        onClick={() => void enviar()}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0097b2] py-2.5 text-sm font-semibold text-white hover:bg-[#008099] disabled:opacity-50"
      >
        <Send className="h-4 w-4" aria-hidden />
        {enviando ? 'Enviando…' : 'Enviar ao canal financeiro'}
      </button>

      {historico.length > 0 ? (
        <div className="mt-6 border-t border-gray-100 pt-4">
          <h3 className="text-sm font-semibold text-gray-800">Enviados nesta sessão</h3>
          <ul className="mt-2 space-y-2">
            {historico.map((h) => (
              <li key={h.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm">
                <div className="font-medium text-gray-800">{h.titulo}</div>
                <div className="text-xs text-gray-500">
                  {h.destino === 'profissional' ? 'Profissional' : 'Empresa'} · {h.nome} ·{' '}
                  {new Date(h.createdAt).toLocaleString('pt-BR')}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
