'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, Ban } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  formatarValorDiaria,
  parseComodidadesExtras,
  parseComodidadesPadrao,
  rotuloAcomodacaoResumo,
  type HospedagemAcomodacaoRow,
} from '@/lib/hospedagemAcomodacoesCatalogo'
import {
  carregarPeriodosOcupacaoAcomodacao,
  type PeriodoOcupacao,
} from '@/lib/hospedagemCalendario'
import CalendarioAcomodacao from '@/components/hospedagem/CalendarioAcomodacao'

type Props = {
  empresaId: string
}

function mapRow(raw: Record<string, unknown>): HospedagemAcomodacaoRow {
  return {
    id: String(raw.id),
    empresa_id: String(raw.empresa_id),
    categoria_imovel: String(raw.categoria_imovel),
    categoria_particular: raw.categoria_particular != null ? String(raw.categoria_particular) : null,
    opcao_compartilhada: raw.opcao_compartilhada != null ? String(raw.opcao_compartilhada) : null,
    capacidade_pessoas: Number(raw.capacidade_pessoas) || 1,
    valor_diaria: Number(raw.valor_diaria) || 0,
    fotos: Array.isArray(raw.fotos) ? raw.fotos.map(String) : [],
    comodidades_padrao: parseComodidadesPadrao(raw.comodidades_padrao),
    comodidades_extras: parseComodidadesExtras(raw.comodidades_extras),
  }
}

export default function CalendarioReservasHospedagem({ empresaId }: Props) {
  const [lista, setLista] = useState<HospedagemAcomodacaoRow[]>([])
  const [periodosMap, setPeriodosMap] = useState<Record<string, PeriodoOcupacao[]>>({})
  const [abertoId, setAbertoId] = useState<string | null>(null)
  const [editarId, setEditarId] = useState<string | null>(null)
  const [selecao, setSelecao] = useState<Set<string>>(new Set())
  const [carregando, setCarregando] = useState(true)
  const [bloqueando, setBloqueando] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    if (!empresaId) return
    setCarregando(true)
    setErro(null)
    try {
      const { data, error } = await supabase
        .from('hospedagem_acomodacoes')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: true })
      if (error) throw error
      const rows = (data ?? []).map((r) => mapRow(r as Record<string, unknown>))
      setLista(rows)
      const pm: Record<string, PeriodoOcupacao[]> = {}
      await Promise.all(
        rows.map(async (a) => {
          pm[a.id] = await carregarPeriodosOcupacaoAcomodacao(supabase, a.id)
        }),
      )
      setPeriodosMap(pm)
      if (rows.length && !abertoId) setAbertoId(rows[0].id)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar calendário.')
    } finally {
      setCarregando(false)
    }
  }, [empresaId, abertoId])

  useEffect(() => {
    void carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carregar na montagem / empresa
  }, [empresaId])

  const toggleDia = (iso: string) => {
    setSelecao((prev) => {
      const next = new Set(prev)
      if (next.has(iso)) next.delete(iso)
      else next.add(iso)
      return next
    })
  }

  const bloquear = async (acomodacaoId: string) => {
    if (selecao.size === 0) {
      setErro('Selecione ao menos uma data para bloquear.')
      return
    }
    setBloqueando(true)
    setErro(null)
    setMsg(null)
    try {
      const datas = [...selecao].sort()
      // Agrupa datas consecutivas em intervalos
      const intervalos: { inicio: string; fim: string }[] = []
      let ini = datas[0]
      let fim = datas[0]
      for (let i = 1; i < datas.length; i++) {
        const prev = new Date(`${fim}T12:00:00`)
        prev.setDate(prev.getDate() + 1)
        const esperado = prev.toISOString().slice(0, 10)
        if (datas[i] === esperado) {
          fim = datas[i]
        } else {
          intervalos.push({ inicio: ini, fim })
          ini = datas[i]
          fim = datas[i]
        }
      }
      intervalos.push({ inicio: ini, fim })

      const rows = intervalos.map((iv) => ({
        acomodacao_id: acomodacaoId,
        empresa_id: empresaId,
        data_inicio: iv.inicio,
        data_fim: iv.fim,
        motivo: 'Bloqueio manual (outros canais)',
      }))

      const { error } = await supabase.from('hospedagem_bloqueios_calendario').insert(rows)
      if (error) throw error

      setMsg('Datas bloqueadas com sucesso.')
      setSelecao(new Set())
      setEditarId(null)
      const periodos = await carregarPeriodosOcupacaoAcomodacao(supabase, acomodacaoId)
      setPeriodosMap((m) => ({ ...m, [acomodacaoId]: periodos }))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível bloquear.')
    } finally {
      setBloqueando(false)
    }
  }

  if (carregando) {
    return <p className="p-4 text-sm text-gray-500">Carregando calendários…</p>
  }

  if (lista.length === 0) {
    return (
      <p className="p-4 text-sm text-gray-500">
        Cadastre acomodações no Botão Dinâmico para gerenciar o calendário de reservas.
      </p>
    )
  }

  return (
    <div className="space-y-3 p-4">
      <p className="text-sm text-gray-600">
        Cada acomodação tem seu calendário. Verde = disponível, azul = ocupado/bloqueado.
      </p>
      {erro ? <p className="text-sm text-rose-600">{erro}</p> : null}
      {msg ? <p className="text-sm text-emerald-700">{msg}</p> : null}

      <ul className="space-y-3">
        {lista.map((a) => {
          const aberto = abertoId === a.id
          const editando = editarId === a.id
          const periodos = periodosMap[a.id] ?? []
          const capa = a.fotos[0]
          return (
            <li key={a.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <button
                type="button"
                onClick={() => setAbertoId(aberto ? null : a.id)}
                className="flex w-full items-center gap-3 p-3 text-left"
              >
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                  {capa ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={capa} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#001f3f]">
                    {rotuloAcomodacaoResumo(a)}
                  </p>
                  <p className="text-xs text-[#0097b2]">{formatarValorDiaria(a.valor_diaria)}</p>
                </div>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${
                    aberto ? 'rotate-180' : ''
                  }`}
                  aria-hidden
                />
              </button>

              {aberto ? (
                <div className="space-y-3 border-t border-gray-100 p-3">
                  <CalendarioAcomodacao
                    periodos={periodos}
                    modoSelecao={editando}
                    selecao={editando ? selecao : undefined}
                    onToggleDia={editando ? toggleDia : undefined}
                  />

                  <button
                    type="button"
                    onClick={() => {
                      if (editando) {
                        setEditarId(null)
                        setSelecao(new Set())
                      } else {
                        setEditarId(a.id)
                        setSelecao(new Set())
                      }
                    }}
                    className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-[#f5f5f5] px-3 py-2.5 text-sm font-semibold text-[#001f3f]"
                  >
                    Editar Calendário
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${editando ? 'rotate-180' : ''}`}
                      aria-hidden
                    />
                  </button>

                  {editando ? (
                    <div className="space-y-2 rounded-lg border border-[#0097b2]/30 bg-[#0097b2]/5 p-3">
                      <p className="text-xs text-gray-600">
                        Toque nas datas verdes para marcar bloqueio (reservas de outros canais).
                        Depois clique em BLOQUEAR.
                      </p>
                      <p className="text-xs font-semibold text-[#001f3f]">
                        {selecao.size} data(s) selecionada(s)
                      </p>
                      <button
                        type="button"
                        disabled={bloqueando || selecao.size === 0}
                        onClick={() => void bloquear(a.id)}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0097b2] py-2.5 text-sm font-bold text-white disabled:opacity-50"
                      >
                        <Ban className="h-4 w-4" aria-hidden />
                        {bloqueando ? 'Bloqueando…' : 'BLOQUEAR'}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
