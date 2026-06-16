'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, CircleDot, Info, MapPin } from 'lucide-react'
import { useServicosTabeladosProfissional } from '@/hooks/useServicosTabeladosProfissional'
import { CIDADES_ORIGEM_TABELADO } from '@/lib/servicosTabeladosCatalogo'

const COR_ICONE_ROTA = '#00D443'
const TEXTO_INFO_TABELADOS =
  'Valores de referência para deslocamento (tickets e ingressos são negociados à parte). Sincronizado com o painel administrativo.'

function limparPontoPartida(texto) {
  return String(texto ?? '')
    .replace(/^\s*→\s*/u, '')
    .replace(/\s*→\s*$/u, '')
    .trim()
}

function BotaoInfoServicosTabelados({ aberto, onToggle, onFechar }) {
  const btnRef = useRef(/** @type {HTMLButtonElement | null} */ (null))
  const popupRef = useRef(/** @type {HTMLDivElement | null} */ (null))
  const [popupPos, setPopupPos] = useState(/** @type {{ top: number; left: number; width: number } | null} */ (null))

  const atualizarPosicao = useCallback(() => {
    const btn = btnRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const largura = Math.min(280, window.innerWidth - 24)
    const left = Math.max(12, Math.min(rect.right - largura, window.innerWidth - largura - 12))
    setPopupPos({
      top: rect.bottom + 10,
      left,
      width: largura,
    })
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
    const onPointerDown = (e) => {
      const alvo = /** @type {Node} */ (e.target)
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
            {TEXTO_INFO_TABELADOS}
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
        aria-label="Informações sobre serviços tabelados"
        aria-expanded={aberto}
      >
        <Info className="h-4 w-4" strokeWidth={2.25} aria-hidden />
      </button>
      {popup}
    </div>
  )
}

function CabecalhoTabela({ infoAberto, onToggleInfo, onFecharInfo }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <h2 className="text-lg font-bold text-[#001f3f]">Serviços Tabelados</h2>
      <BotaoInfoServicosTabelados aberto={infoAberto} onToggle={onToggleInfo} onFechar={onFecharInfo} />
    </div>
  )
}

function LinhaRota({ rota }) {
  const partida = limparPontoPartida(rota.pontoPartida)
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-3">
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <CircleDot className="h-4 w-4 shrink-0" style={{ color: COR_ICONE_ROTA }} strokeWidth={2.25} aria-hidden />
          <span className="min-w-0 truncate">{partida}</span>
        </p>
        <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <MapPin className="h-4 w-4 shrink-0" style={{ color: COR_ICONE_ROTA }} strokeWidth={2.25} aria-hidden />
          <span className="min-w-0 truncate">{rota.destinoFinal}</span>
        </p>
      </div>
      <p className="shrink-0 text-sm font-bold text-[#0097b2]">
        R$ {rota.valorRota.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
      </p>
    </li>
  )
}

/**
 * @param {{ usuarioId: string | null, placaVermelha?: boolean }} props
 */
export default function TabelaValores({ usuarioId, placaVermelha = false }) {
  const { rotas, loading, categoria } = useServicosTabeladosProfissional(usuarioId, placaVermelha)
  const [infoAberto, setInfoAberto] = useState(false)
  const [pastasAbertas, setPastasAbertas] = useState(/** @type {Record<string, boolean>} */ ({}))

  const porCidade = rotas.reduce((acc, rota) => {
    const key = rota.cidadeOrigem
    if (!acc[key]) acc[key] = []
    acc[key].push(rota)
    return acc
  }, /** @type {Record<string, typeof rotas>} */ ({}))

  const cidadesIds = Object.keys(porCidade)

  useEffect(() => {
    if (!cidadesIds.length) return
    setPastasAbertas((atual) => {
      const next = { ...atual }
      let alterou = false
      for (const id of cidadesIds) {
        if (next[id] === undefined) {
          next[id] = id === cidadesIds[0]
          alterou = true
        }
      }
      return alterou ? next : atual
    })
  }, [cidadesIds.join(',')])

  const togglePasta = (cidadeId) => {
    setPastasAbertas((p) => ({ ...p, [cidadeId]: !p[cidadeId] }))
  }

  if (!placaVermelha) {
    return (
      <div className="space-y-4">
        <CabecalhoTabela
          infoAberto={infoAberto}
          onToggleInfo={() => setInfoAberto((v) => !v)}
          onFecharInfo={() => setInfoAberto(false)}
        />
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-6 text-center text-sm text-amber-800">
          Serviços tabelados disponíveis apenas para profissionais credenciados (placa vermelha).
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <CabecalhoTabela
          infoAberto={infoAberto}
          onToggleInfo={() => setInfoAberto((v) => !v)}
          onFecharInfo={() => setInfoAberto(false)}
        />
        <div className="space-y-2 py-2" aria-busy="true">
          <div className="h-14 animate-pulse rounded-xl bg-gray-100" />
          <div className="h-14 animate-pulse rounded-xl bg-gray-100" />
        </div>
      </div>
    )
  }

  if (!categoria) {
    return (
      <div className="space-y-4">
        <CabecalhoTabela
          infoAberto={infoAberto}
          onToggleInfo={() => setInfoAberto((v) => !v)}
          onFecharInfo={() => setInfoAberto(false)}
        />
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-8 text-center text-sm text-gray-500">
          Categoria não mapeada para serviços tabelados. Entre em contato com o suporte.
        </div>
      </div>
    )
  }

  if (rotas.length === 0) {
    return (
      <div className="space-y-4">
        <CabecalhoTabela
          infoAberto={infoAberto}
          onToggleInfo={() => setInfoAberto((v) => !v)}
          onFecharInfo={() => setInfoAberto(false)}
        />
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-8 text-center text-sm text-gray-500">
          Nenhuma rota tabelada cadastrada para sua categoria no momento.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <CabecalhoTabela
        infoAberto={infoAberto}
        onToggleInfo={() => setInfoAberto((v) => !v)}
        onFecharInfo={() => setInfoAberto(false)}
      />

      <div className="space-y-3">
        {Object.entries(porCidade).map(([cidadeId, lista]) => {
          const meta = CIDADES_ORIGEM_TABELADO[/** @type {keyof typeof CIDADES_ORIGEM_TABELADO} */ (cidadeId)]
          const aberta = pastasAbertas[cidadeId] ?? false
          return (
            <section key={cidadeId} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <button
                type="button"
                onClick={() => togglePasta(cidadeId)}
                className="flex w-full items-center justify-between gap-2 bg-[#0097b2] px-3 py-2.5 text-left text-sm font-bold text-white transition hover:brightness-105"
                aria-expanded={aberta}
              >
                <span className="min-w-0 truncate">{meta?.label ?? cidadeId}</span>
                <ChevronDown
                  className={`h-5 w-5 shrink-0 transition-transform duration-200 ${aberta ? 'rotate-180' : ''}`}
                  strokeWidth={2.25}
                  aria-hidden
                />
              </button>
              {aberta ? (
                <ul className="divide-y divide-gray-100">
                  {lista.map((rota) => (
                    <LinhaRota key={rota.id} rota={rota} />
                  ))}
                </ul>
              ) : null}
            </section>
          )
        })}
      </div>
    </div>
  )
}
