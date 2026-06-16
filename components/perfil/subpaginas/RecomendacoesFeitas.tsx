'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  buscarRecomendacoesPorEmpresaParaProfissional,
  getDataLimiteRecomendacoesProf,
  resolverProfissionalIdPorUsuario,
  type PeriodoRecomendacoesProf,
  type RecomendacaoEmpresaHistorico,
} from '@/lib/recomendacoesProfissionalHistorico'
import LinhaEmpresaRecomendacao from './recomendacoes/LinhaEmpresaRecomendacao'

const TEXTO_INFO_RECOMENDACOES =
  'Histórico das empresas que você recomendou no app. Os dados são os mesmos do funil de conversão da empresa — contatos dos turistas aparecem mascarados por privacidade.'

const PERIODOS: { id: PeriodoRecomendacoesProf; label: string }[] = [
  { id: 'mes', label: 'Este mês' },
  { id: '30d', label: '30 dias' },
  { id: '90d', label: '90 dias' },
]

function BotaoInfoRecomendacoes({
  aberto,
  onToggle,
  onFechar,
}: {
  aberto: boolean
  onToggle: () => void
  onFechar: () => void
}) {
  const btnRef = useRef<HTMLButtonElement | null>(null)
  const popupRef = useRef<HTMLDivElement | null>(null)
  const [popupPos, setPopupPos] = useState<{ top: number; left: number; width: number } | null>(null)

  const atualizarPosicao = useCallback(() => {
    const btn = btnRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const largura = Math.min(280, window.innerWidth - 24)
    const left = Math.max(12, Math.min(rect.right - largura, window.innerWidth - largura - 12))
    setPopupPos({ top: rect.bottom + 10, left, width: largura })
  }, [])

  useEffect(() => {
    if (!aberto) {
      setPopupPos(null)
      return
    }
    atualizarPosicao()
    window.addEventListener('resize', atualizarPosicao)
    window.addEventListener('scroll', atualizarPosicao, true)
    return () => {
      window.removeEventListener('resize', atualizarPosicao)
      window.removeEventListener('scroll', atualizarPosicao, true)
    }
  }, [aberto, atualizarPosicao])

  useEffect(() => {
    if (!aberto) return
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const alvo = e.target as Node
      if (btnRef.current?.contains(alvo) || popupRef.current?.contains(alvo)) return
      onFechar()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
    }
  }, [aberto, onFechar])

  const popup =
    aberto && popupPos && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={popupRef}
            role="tooltip"
            style={{ position: 'fixed', top: popupPos.top, left: popupPos.left, width: popupPos.width }}
            className="z-[200] rounded-lg bg-[#0097b2] px-2.5 py-2 text-left text-[11px] leading-snug text-white shadow-lg"
          >
            {TEXTO_INFO_RECOMENDACOES}
          </div>,
          document.body,
        )
      : null

  return (
    <div className="relative shrink-0">
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onToggle()
        }}
        className="flex h-7 w-7 items-center justify-center rounded-full text-[#0097b2] transition hover:bg-[#0097b2]/10"
        aria-label="Informações sobre recomendações feitas"
        aria-expanded={aberto}
      >
        <Info className="h-4 w-4" strokeWidth={2.25} aria-hidden />
      </button>
      {popup}
    </div>
  )
}

type Props = {
  usuarioId: string | null
}

export default function RecomendacoesFeitas({ usuarioId }: Props) {
  const [periodo, setPeriodo] = useState<PeriodoRecomendacoesProf>('mes')
  const [empresas, setEmpresas] = useState<RecomendacaoEmpresaHistorico[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [infoAberto, setInfoAberto] = useState(false)

  const dataLimite = useMemo(() => getDataLimiteRecomendacoesProf(periodo), [periodo])

  const totalRecomendacoes = useMemo(
    () => empresas.reduce((acc, e) => acc + e.total, 0),
    [empresas],
  )

  const carregar = useCallback(async () => {
    if (!usuarioId) {
      setEmpresas([])
      setLoading(false)
      return
    }
    setLoading(true)
    setErro(null)
    try {
      const profissionalId = await resolverProfissionalIdPorUsuario(supabase, usuarioId)
      if (!profissionalId) {
        setEmpresas([])
        return
      }
      const lista = await buscarRecomendacoesPorEmpresaParaProfissional(
        supabase,
        profissionalId,
        dataLimite,
      )
      setEmpresas(lista)
    } catch {
      setErro('Não foi possível carregar suas recomendações.')
      setEmpresas([])
    } finally {
      setLoading(false)
    }
  }, [usuarioId, dataLimite])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const periodoCls = (ativo: boolean) =>
    `flex-1 rounded-lg px-2 py-2 text-xs font-semibold transition-colors sm:text-sm ${
      ativo ? 'bg-[#00D443] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
    }`

  return (
    <div className="flex flex-col pb-4">
      <div className="flex items-start justify-end gap-2 px-1">
        <BotaoInfoRecomendacoes
          aberto={infoAberto}
          onToggle={() => setInfoAberto((v) => !v)}
          onFechar={() => setInfoAberto(false)}
        />
      </div>

      <div className="mt-2 flex gap-1 px-1" role="tablist" aria-label="Período do histórico">
        {PERIODOS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={periodo === p.id}
            onClick={() => setPeriodo(p.id)}
            className={periodoCls(periodo === p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {!loading && !erro && empresas.length > 0 ? (
        <p className="mt-3 px-1 text-sm text-gray-600">
          <span className="font-semibold text-[#001f3f]">{totalRecomendacoes}</span>
          {totalRecomendacoes === 1 ? ' recomendação' : ' recomendações'} em{' '}
          <span className="font-semibold text-[#001f3f]">{empresas.length}</span>{' '}
          {empresas.length === 1 ? 'empresa' : 'empresas'}
        </p>
      ) : null}

      <div className="mt-3 px-1">
        {loading ? (
          <p className="py-8 text-center text-sm text-gray-500">Carregando recomendações...</p>
        ) : erro ? (
          <p className="py-8 text-center text-sm text-rose-600">{erro}</p>
        ) : empresas.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-10 text-center text-sm text-gray-500">
            Nenhuma recomendação registrada neste período.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            {empresas.map((emp, idx) => (
              <LinhaEmpresaRecomendacao key={emp.empresa_id} empresa={emp} posicao={idx + 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
