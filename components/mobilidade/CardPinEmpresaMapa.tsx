'use client'

import { X } from 'lucide-react'
import { useRouter } from '@/i18n/navigation'
import type { EmpresaMapaMobilidade } from '@/lib/mobilidadeMapaEmpresas'

type Props = {
  empresa: EmpresaMapaMobilidade
  onFechar: () => void
}

/** Card compacto flutuante ao clicar no pin da empresa no mapa. */
export default function CardPinEmpresaMapa({ empresa, onFechar }: Props) {
  const router = useRouter()
  const username = String(empresa.nome_usuario ?? '')
    .replace(/^@+/, '')
    .trim()
  const nome = String(empresa.nome_fantasia ?? '').trim() || 'Empresa'
  const inicial = nome.charAt(0).toUpperCase() || '?'

  return (
    <div className="pointer-events-auto absolute inset-x-3 bottom-[max(5.25rem,calc(env(safe-area-inset-bottom)+4.25rem))] z-30 mx-auto max-w-lg sm:inset-x-auto sm:left-1/2 sm:w-[min(100%-1.5rem,28rem)] sm:-translate-x-1/2">
      <div className="flex items-center gap-3 rounded-2xl bg-white/95 p-3 shadow-2xl ring-1 ring-black/10 backdrop-blur-sm">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gray-100">
          {empresa.foto_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={empresa.foto_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#0097b2] text-lg font-bold text-white">
              {inicial}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-gray-900">{nome}</p>
          {username ? (
            <p className="truncate text-xs text-[#0097b2]">@{username}</p>
          ) : (
            <p className="truncate text-xs text-gray-500">{empresa.cidade}</p>
          )}
          <button
            type="button"
            onClick={() => router.push(`/empresa/${empresa.id}`)}
            className="mt-2 inline-flex rounded-full bg-[#00D443] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white"
          >
            Ver página
          </button>
        </div>

        <button
          type="button"
          onClick={onFechar}
          className="shrink-0 self-start rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
