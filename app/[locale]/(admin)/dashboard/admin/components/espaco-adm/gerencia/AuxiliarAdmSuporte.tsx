'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Loader2, Search, UserPlus } from 'lucide-react'
import AvatarImage from '@/components/AvatarImage'
import { CardUsuarioConvite } from './CardUsuarioConvite'

const COR_LOGO = '#0097b2'

type ItemPendente = {
  id: string
  empresa_id: string
  created_at: string
  plano_nome: string
  empresa: {
    empresa_id: string
    nome: string
    username: string
    foto_url: string | null
  } | null
}

type AuxiliarEncontrado = {
  id: string
  username: string
  nome_social: string
  foto_url: string | null
}

function formatarData(iso: string) {
  try {
    return new Date(iso).toLocaleString('pt-BR')
  } catch {
    return '—'
  }
}

function CardEmpresaPendente({
  item,
  children,
}: {
  item: ItemPendente
  children?: React.ReactNode
}) {
  const [aberto, setAberto] = useState(false)
  const emp = item.empresa

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <AvatarImage
          src={emp?.foto_url ?? null}
          alt={emp?.nome ?? 'Empresa'}
          className="h-12 w-12 shrink-0 rounded-full object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-gray-900">{emp?.nome ?? 'Empresa'}</p>
          <p className="truncate text-xs text-[#0097b2]">@{emp?.username ?? 'empresa'}</p>
          <p className="mt-1 text-xs font-semibold text-gray-600">{item.plano_nome}</p>
        </div>
        {aberto ? (
          <ChevronUp className="h-5 w-5 shrink-0 text-gray-500" />
        ) : (
          <ChevronDown className="h-5 w-5 shrink-0 text-gray-500" />
        )}
      </button>
      {aberto ? (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-4">
          <p className="mb-3 text-xs text-gray-500">Solicitado em {formatarData(item.created_at)}</p>
          {children}
        </div>
      ) : null}
    </div>
  )
}

export function AuxiliarAdmSuporte() {
  const [items, setItems] = useState<ItemPendente[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [termos, setTermos] = useState<Record<string, string>>({})
  const [auxiliares, setAuxiliares] = useState<Record<string, AuxiliarEncontrado | null>>({})
  const [buscando, setBuscando] = useState<Record<string, boolean>>({})
  const [autorizando, setAutorizando] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const res = await fetch('/api/admin/auxiliar-adm-empresa', { credentials: 'include' })
      const json = (await res.json()) as { ok?: boolean; items?: ItemPendente[]; error?: string }
      if (!res.ok || !json.ok) {
        setErro(json.error ?? 'Não foi possível carregar solicitações.')
        setItems([])
        return
      }
      setItems(json.items ?? [])
    } catch {
      setErro('Falha de conexão.')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const buscarAuxiliar = async (solicitacaoId: string) => {
    const q = (termos[solicitacaoId] ?? '').trim().replace(/^@+/, '')
    if (q.length < 2) return
    setBuscando((prev) => ({ ...prev, [solicitacaoId]: true }))
    try {
      const res = await fetch(
        `/api/admin/convites/buscar-usuario?q=${encodeURIComponent(q)}&somente_auxiliar=1`,
        { credentials: 'include' },
      )
      const json = (await res.json()) as {
        ok?: boolean
        usuario?: AuxiliarEncontrado | null
        error?: string
      }
      setAuxiliares((prev) => ({
        ...prev,
        [solicitacaoId]: json.usuario ?? null,
      }))
      if (!json.usuario) {
        setFeedback(json.error ?? 'Auxiliar ADM não encontrado.')
      } else {
        setFeedback(null)
      }
    } finally {
      setBuscando((prev) => ({ ...prev, [solicitacaoId]: false }))
    }
  }

  const autorizar = async (solicitacaoId: string, auxiliarId: string) => {
    setAutorizando(solicitacaoId)
    setFeedback(null)
    try {
      const res = await fetch('/api/admin/auxiliar-adm-empresa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ solicitacao_id: solicitacaoId, auxiliar_usuario_id: auxiliarId }),
      })
      const json = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !json.ok) {
        setFeedback(json.error ?? 'Não foi possível autorizar.')
        return
      }
      setFeedback('Auxiliar ADM autorizado com sucesso.')
      await carregar()
    } catch {
      setFeedback('Falha ao autorizar.')
    } finally {
      setAutorizando(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-[#0097b2]" />
      </div>
    )
  }

  return (
    <div className="space-y-3 text-sm">
      {erro ? <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-800">{erro}</div> : null}
      {feedback ? (
        <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">{feedback}</div>
      ) : null}

      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">
          Nenhuma empresa aguardando atribuição de Auxiliar ADM.
        </p>
      ) : (
        items.map((item) => {
          const aux = auxiliares[item.id]
          return (
            <CardEmpresaPendente key={item.id} item={item}>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700">
                    Localizar Auxiliar ADM
                  </label>
                  <input
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                    placeholder="Nome ou @username"
                    value={termos[item.id] ?? ''}
                    onChange={(e) =>
                      setTermos((prev) => ({ ...prev, [item.id]: e.target.value }))
                    }
                  />
                </div>
                <div className="flex justify-center">
                  <button
                    type="button"
                    disabled={Boolean(buscando[item.id])}
                    onClick={() => void buscarAuxiliar(item.id)}
                    className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    style={{ backgroundColor: COR_LOGO }}
                  >
                    <Search className="h-4 w-4 text-white" aria-hidden />
                    {buscando[item.id] ? 'Pesquisando…' : 'PESQUISAR'}
                  </button>
                </div>
                {aux ? (
                  <div className="space-y-3">
                    <CardUsuarioConvite
                      nomeSocial={aux.nome_social}
                      username={aux.username}
                      fotoUrl={aux.foto_url}
                    />
                    <div className="flex justify-center">
                      <button
                        type="button"
                        disabled={autorizando === item.id}
                        onClick={() => void autorizar(item.id, aux.id)}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#00D443] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                      >
                        <UserPlus className="h-4 w-4 text-white" aria-hidden />
                        {autorizando === item.id ? 'Autorizando…' : 'AUTORIZAR'}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </CardEmpresaPendente>
          )
        })
      )}
    </div>
  )
}
