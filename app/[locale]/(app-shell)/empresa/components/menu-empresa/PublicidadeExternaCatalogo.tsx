'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, MessageCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { openWhatsAppChat } from '@/lib/whatsapp-empresa'
import {
  buscarConfigPublicidadeExterna,
  listarCardsPublicidadeExterna,
  type PublicidadeExternaCard,
} from '@/lib/publicidadeExterna'
import SecaoChevron from './SecaoChevron'

const COR = '#0097b2'
const VERDE_WA = '#25D366'

function CarrosselFotos({ fotos }: { fotos: string[] }) {
  const [fotoIdx, setFotoIdx] = useState(0)
  const touchFotoX = useRef<number | null>(null)

  useEffect(() => {
    setFotoIdx(0)
  }, [fotos])

  if (!fotos.length) {
    return <div className="mx-0 aspect-[16/10] rounded-xl bg-gray-100" />
  }

  return (
    <div className="relative px-6">
      <div
        className="aspect-[16/10] w-full touch-pan-y overflow-hidden rounded-xl bg-gray-100"
        onTouchStart={(e) => {
          touchFotoX.current = e.touches[0]?.clientX ?? null
        }}
        onTouchEnd={(e) => {
          const start = touchFotoX.current
          touchFotoX.current = null
          if (start == null || fotos.length <= 1) return
          const end = e.changedTouches[0]?.clientX
          if (end == null) return
          const dx = end - start
          if (Math.abs(dx) < 40) return
          if (dx < 0) setFotoIdx((i) => (i + 1) % fotos.length)
          else setFotoIdx((i) => (i - 1 + fotos.length) % fotos.length)
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={fotos[fotoIdx] ?? fotos[0]}
          alt=""
          className="pointer-events-none h-full w-full object-cover"
          draggable={false}
        />
      </div>
      {fotos.length > 1 ? (
        <>
          <button
            type="button"
            className="absolute left-0 top-1/2 z-10 flex w-6 -translate-y-1/2 items-center justify-center"
            style={{ color: COR }}
            onClick={() => setFotoIdx((i) => (i - 1 + fotos.length) % fotos.length)}
            aria-label="Foto anterior"
          >
            <ChevronLeft className="h-6 w-6" strokeWidth={2.5} aria-hidden />
          </button>
          <button
            type="button"
            className="absolute right-0 top-1/2 z-10 flex w-6 -translate-y-1/2 items-center justify-center"
            style={{ color: COR }}
            onClick={() => setFotoIdx((i) => (i + 1) % fotos.length)}
            aria-label="Próxima foto"
          >
            <ChevronRight className="h-6 w-6" strokeWidth={2.5} aria-hidden />
          </button>
        </>
      ) : null}
    </div>
  )
}

export default function PublicidadeExternaCatalogo() {
  const [cards, setCards] = useState<PublicidadeExternaCard[]>([])
  const [whatsapp, setWhatsapp] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [abertoId, setAbertoId] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      const [lista, cfg] = await Promise.all([
        listarCardsPublicidadeExterna(supabase),
        buscarConfigPublicidadeExterna(supabase),
      ])
      setCards(lista)
      const wa = cfg?.whatsapp != null ? String(cfg.whatsapp).trim() : ''
      setWhatsapp(wa || null)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar o catálogo.')
      setCards([])
      setWhatsapp(null)
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  if (carregando) {
    return <p className="text-sm text-gray-500">Carregando catálogo…</p>
  }

  if (erro) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erro}</div>
    )
  }

  if (cards.length === 0 && !whatsapp) {
    return (
      <p className="text-sm text-gray-600">
        Nenhum serviço de publicidade externa cadastrado no momento.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {cards.map((card) => {
        const aberto = abertoId === card.id
        return (
          <SecaoChevron
            key={card.id}
            titulo={card.titulo}
            aberta={aberto}
            onToggle={() => setAbertoId((prev) => (prev === card.id ? null : card.id))}
          >
            <div className="space-y-3">
              <CarrosselFotos fotos={card.fotos} />
              {card.descricao.trim() ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                  {card.descricao}
                </p>
              ) : null}
            </div>
          </SecaoChevron>
        )
      })}

      {whatsapp ? (
        <div className="space-y-3 pt-2 text-center">
          <p className="text-sm font-semibold text-gray-800">Fale conosco:</p>
          <button
            type="button"
            onClick={() => {
              if (!openWhatsAppChat(whatsapp)) {
                window.alert('Não foi possível abrir o WhatsApp.')
              }
            }}
            className="mx-auto flex w-full max-w-xs items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white shadow-sm"
            style={{ backgroundColor: VERDE_WA }}
          >
            <MessageCircle className="h-5 w-5 text-white" aria-hidden />
            WhatsApp
          </button>
        </div>
      ) : null}
    </div>
  )
}
