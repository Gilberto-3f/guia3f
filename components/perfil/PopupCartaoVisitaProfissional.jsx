'use client'

import Image from 'next/image'
import { ShieldCheck, Star, X } from 'lucide-react'

function formatMesAno(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const s = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** @param {string[] | null | undefined} categorias */
function normalizarCategorias(categorias) {
  if (!Array.isArray(categorias)) return []
  return categorias
    .map((c) => String(c ?? '').trim().toLowerCase())
    .filter(Boolean)
}

/**
 * Regra do botão contratar (UI):
 * - Permitido: taxista, motorista de van, guia, etc
 * - Bloqueado: motorista de app, anfitrião
 * - `placa_vermelha` dá preferência a mostrar contratar
 */
function deveMostrarContratar({ placaVermelha, categorias }) {
  if (placaVermelha) return true
  const cats = normalizarCategorias(categorias)
  if (cats.some((c) => c.includes('anfitri'))) return false
  if (cats.some((c) => c.includes('app'))) return false
  if (cats.some((c) => c.includes('tax'))) return true
  if (cats.some((c) => c.includes('van'))) return true
  if (cats.some((c) => c.includes('guia'))) return true
  return false
}

/**
 * @param {{
 *  aberto: boolean
 *  onFechar: () => void
 *  nome: string
 *  username: string
 *  avatarUrl: string | null
 *  verificadoEm: string | null
 *  categorias?: string[] | null
 *  placaVermelha?: boolean
 *  onContratar?: () => void
 * }} props
 */
export default function PopupCartaoVisitaProfissional({
  aberto,
  onFechar,
  nome,
  username,
  avatarUrl,
  verificadoEm,
  categorias = null,
  placaVermelha = false,
  onContratar,
}) {
  if (!aberto) return null

  const mesAno = formatMesAno(verificadoEm)
  const u = String(username ?? '').trim().replace(/^@+/, '')
  const uShown = u.length > 15 ? `${u.slice(0, 15)}…` : u
  const podeContratar = deveMostrarContratar({ placaVermelha, categorias })

  // Placeholder até existir mobilidade/avaliações profissionais
  const media = 0
  const total = 0

  return (
    <div
      className="fixed inset-0 z-[240] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onClick={onFechar}
      role="presentation"
    >
      <div
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white text-black shadow-xl sm:max-h-[85vh] sm:rounded-2xl"
        style={{ height: 'min(72vh, 86vh)' }}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative shrink-0 border-b border-gray-100 bg-white pt-4 pb-3">
          <div className="flex items-center justify-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[#0097b2]" aria-hidden />
            <h2 className="text-xl font-bold text-[#0097b2]">Profissional de Confiança</h2>
          </div>
          <p className="mt-1 text-center text-sm text-gray-600">
            {mesAno ? (
              <>
                Verificado desde <span className="font-semibold text-gray-800">{mesAno}</span>
              </>
            ) : (
              'Verificado'
            )}
          </p>
          <button
            type="button"
            onClick={onFechar}
            className="absolute right-3 top-3 rounded-full p-1 hover:bg-gray-100"
            aria-label="Fechar"
          >
            <X size={22} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <div className="flex flex-col items-center text-center">
            <div className="relative h-24 w-24 overflow-hidden rounded-full bg-gray-100 ring-2 ring-[#0097b2]/15">
              {avatarUrl ? <Image src={avatarUrl} alt="" fill className="object-cover" sizes="96px" /> : null}
            </div>
            <p className="mt-4 max-w-full truncate text-lg font-bold text-gray-900">{nome || 'Profissional'}</p>
            <p className="mt-0.5 max-w-full truncate text-sm font-normal text-gray-600">@{uShown || 'usuario'}</p>

            <div className="mt-6 w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-4">
              <p className="text-sm font-semibold text-gray-800">Nota de avaliação</p>
              <div className="mt-2 flex items-center justify-center gap-2">
                <Star className="h-5 w-5 text-amber-400 fill-amber-400" aria-hidden />
                <span className="text-xl font-bold text-gray-900">{total ? media.toFixed(1).replace('.', ',') : '—'}</span>
                <span className="text-sm text-gray-500">({total} avaliações)</span>
              </div>
              <p className="mt-2 text-xs text-gray-500">Avaliações serão habilitadas após a implementação da Mobilidade.</p>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-gray-100 bg-white px-5 py-4">
          <div className="flex flex-col gap-2">
            {podeContratar ? (
              <button
                type="button"
                onClick={() => onContratar?.()}
                className="w-full rounded-xl py-3 text-base font-bold text-white"
                style={{ backgroundColor: '#00D443' }}
              >
                CONTRATAR PROFISSIONAL
              </button>
            ) : null}
            <button
              type="button"
              disabled
              title="Disponível após conclusão de serviço"
              className="w-full rounded-xl bg-[#0097b2] py-3 text-base font-bold text-white opacity-60"
            >
              AVALIAR PROFISSIONAL
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

