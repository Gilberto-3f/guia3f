'use client'

import { Star, X } from 'lucide-react'
import { useRouter } from '@/i18n/navigation'
import type { EmpresaMapaMobilidade } from '@/lib/mobilidadeMapaEmpresas'

type Props = {
  empresa: EmpresaMapaMobilidade
  onFechar: () => void
}

/** Card flutuante estilo favoritos: avatar, nome, @, nota, visitar página. */
export default function CardPinEmpresaMapa({ empresa, onFechar }: Props) {
  const router = useRouter()
  const username = String(empresa.nome_usuario ?? '')
    .replace(/^@+/, '')
    .trim()
  const nome = String(empresa.nome_fantasia ?? '').trim() || 'Empresa'
  const inicial = nome.charAt(0).toUpperCase() || '?'
  const nota =
    empresa.nota_media != null && Number.isFinite(empresa.nota_media)
      ? Number(empresa.nota_media).toFixed(1)
      : null

  return (
    <div
      className="pointer-events-auto absolute inset-x-3 bottom-[max(3.75rem,calc(env(safe-area-inset-bottom)+3.25rem))] z-30 mx-auto max-w-lg sm:inset-x-auto sm:left-1/2 sm:w-[min(100%-1.5rem,28rem)] sm:-translate-x-1/2"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 rounded-2xl bg-[#0097b2] p-2.5 shadow-2xl ring-1 ring-black/10">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border-2 border-white bg-white/20">
          {empresa.foto_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={empresa.foto_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-base font-bold text-white">
              {inicial}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 overflow-hidden">
          <p className="truncate text-sm font-bold leading-tight text-white">{nome}</p>
          {username ? (
            <p className="truncate text-xs leading-tight text-white/90">@{username}</p>
          ) : null}
          {nota ? (
            <p className="mt-0.5 flex items-center gap-0.5 text-xs font-semibold text-amber-300">
              <Star className="h-3 w-3 shrink-0 fill-amber-300" aria-hidden />
              {nota}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => router.push(`/empresa/${empresa.id}`)}
          className="shrink-0 rounded-lg bg-white px-2 py-1.5 text-[10px] font-bold uppercase leading-tight tracking-wide text-[#0097b2]"
        >
          Visitar
          <br />
          página
        </button>

        <button
          type="button"
          onClick={onFechar}
          className="shrink-0 rounded-lg p-1 text-white/80 hover:bg-white/15 hover:text-white"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
