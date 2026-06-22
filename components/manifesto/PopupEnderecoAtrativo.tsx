'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import AvatarImage from '@/components/AvatarImage'
import AbaEndereco from '@/components/AbaEndereco'
import { useModalScrollLock } from '@/lib/useModalScrollLock'
import { supabase } from '@/lib/supabase'

type HorariosMap = Record<string, { abre: string; fecha: string; fechado: boolean }>

function asHorarios(value: unknown): HorariosMap {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as HorariosMap
  }
  if (typeof value === 'string') {
    try {
      const p = JSON.parse(value)
      return typeof p === 'object' && p !== null ? (p as HorariosMap) : {}
    } catch {
      return {}
    }
  }
  return {}
}

type Props = {
  aberto: boolean
  onFechar: () => void
  empresaId: string | null
  preview?: {
    nome_fantasia: string
    foto_url?: string | null
  } | null
}

/** Popup isolado com aba endereço do atrativo (padrão visual de modal de atividades). */
export default function PopupEnderecoAtrativo({ aberto, onFechar, empresaId, preview }: Props) {
  useModalScrollLock(aberto)
  const [carregando, setCarregando] = useState(false)
  const [empresaEndereco, setEmpresaEndereco] = useState<{
    id: string
    endereco: string
    bairro: string | null
    cidade: string
    latitude: number | null
    longitude: number | null
    telefone: string | null
    whatsapp: string | null
    website: string | null
    redes_sociais: unknown
    horarios: HorariosMap
    nome_fantasia: string
  } | null>(null)

  useEffect(() => {
    if (!aberto || !empresaId) {
      setEmpresaEndereco(null)
      return
    }

    let cancelado = false
    setCarregando(true)

    void (async () => {
      const { data } = await supabase
        .from('empresas')
        .select(
          'id, nome_fantasia, endereco, bairro, cidade, latitude, longitude, telefone, whatsapp, website, redes_sociais, horarios',
        )
        .eq('id', empresaId)
        .maybeSingle()

      if (cancelado) return

      if (data) {
        const latRaw = data.latitude
        const lngRaw = data.longitude
        const latitude =
          latRaw == null || typeof latRaw === 'object'
            ? null
            : typeof latRaw === 'number'
              ? latRaw
              : Number(latRaw)
        const longitude =
          lngRaw == null || typeof lngRaw === 'object'
            ? null
            : typeof lngRaw === 'number'
              ? lngRaw
              : Number(lngRaw)

        setEmpresaEndereco({
          id: String(data.id),
          endereco: String(data.endereco ?? ''),
          bairro: data.bairro != null ? String(data.bairro) : null,
          cidade: String(data.cidade ?? ''),
          latitude: Number.isFinite(latitude) ? latitude : null,
          longitude: Number.isFinite(longitude) ? longitude : null,
          telefone: data.telefone != null ? String(data.telefone) : null,
          whatsapp: data.whatsapp != null ? String(data.whatsapp) : null,
          website: data.website != null ? String(data.website) : null,
          redes_sociais: data.redes_sociais,
          horarios: asHorarios(data.horarios),
          nome_fantasia: String(data.nome_fantasia ?? preview?.nome_fantasia ?? ''),
        })
      } else {
        setEmpresaEndereco(null)
      }
      setCarregando(false)
    })()

    return () => {
      cancelado = true
    }
  }, [aberto, empresaId, preview?.nome_fantasia])

  if (!aberto || !empresaId) return null

  const nomeFantasia = empresaEndereco?.nome_fantasia ?? preview?.nome_fantasia ?? 'Empresa'
  const fotoUrl = preview?.foto_url

  return (
    <div className="fixed inset-0 z-[250] flex flex-col bg-black/90">
      <header className="flex shrink-0 items-center justify-between gap-2 px-3 py-3 pt-safe text-white">
        <div className="flex min-w-0 items-center gap-3">
          <AvatarImage
            src={fotoUrl}
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 shrink-0 rounded-lg object-cover"
          />
          <p className="truncate font-semibold">{nomeFantasia}</p>
        </div>
        <button
          type="button"
          onClick={onFechar}
          className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-white/10"
          aria-label="Fechar"
        >
          <X className="h-6 w-6" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto rounded-t-2xl bg-white p-4">
        {carregando ? (
          <div className="h-40 animate-pulse rounded-lg bg-gray-100" aria-busy="true" />
        ) : empresaEndereco ? (
          <AbaEndereco empresa={empresaEndereco} mostrarChamarCorrida />
        ) : (
          <p className="text-sm text-gray-600">Não foi possível carregar o endereço desta empresa.</p>
        )}
      </div>
    </div>
  )
}
