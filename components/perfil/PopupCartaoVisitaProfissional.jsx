'use client'

import Image from 'next/image'
import { ShieldCheck, ShieldQuestion, Star, X } from 'lucide-react'
import { formatProfissionalCategorias } from '@/app/[locale]/(admin)/dashboard/admin/components/verificacao/verificacaoFormatters'

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
 *  cadastradoEm?: string | null
 *  categorias?: string[] | null
 *  placaVermelha?: boolean
 *  profissionalVerificado?: boolean
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
  cadastradoEm = null,
  categorias = null,
  placaVermelha = false,
  profissionalVerificado = false,
  onContratar,
}) {
  if (!aberto) return null

  const verificado = profissionalVerificado === true
  const mesAnoCadastro = formatMesAno(cadastradoEm ?? verificadoEm)
  const u = String(username ?? '').trim().replace(/^@+/, '')
  const uShown = u.length > 15 ? `${u.slice(0, 15)}…` : u
  const podeContratar = verificado && deveMostrarContratar({ placaVermelha, categorias })
  const rotuloCategoria = formatProfissionalCategorias(categorias)

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
          {verificado ? (
            <>
              <div className="flex items-center justify-center gap-2">
                <ShieldCheck className="h-5 w-5 text-[#00D443]" aria-hidden />
                <h2 className="text-xl font-bold tracking-wide text-[#00D443]">VERIFICADO</h2>
              </div>
              <p className="mt-1 px-4 text-center text-sm text-gray-600">
                {mesAnoCadastro ? (
                  <>
                    cadastrado desde{' '}
                    <span className="font-semibold text-gray-800">{mesAnoCadastro}</span>
                  </>
                ) : (
                  'Profissional verificado'
                )}
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center justify-center gap-2">
                <ShieldQuestion className="h-5 w-5 text-[#ea580c]" aria-hidden />
                <h2 className="text-xl font-bold tracking-wide text-[#ea580c]">EM ANÁLISE</h2>
              </div>
              <p className="mt-1 px-4 text-center text-sm leading-snug text-gray-600">
                Novo perfil profissional cadastrado. Usuário aguarda verificação da plataforma.
              </p>
            </>
          )}
          <button
            type="button"
            onClick={onFechar}
            className="absolute right-3 top-3 rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-500"
            aria-label="Fechar"
          >
            <X size={22} strokeWidth={2} aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
          <div className="space-y-4">
            <div className="flex w-full justify-center">
              <div className="flex max-w-full flex-row items-center gap-3 sm:gap-5">
                <div
                  className={`relative h-[3.75rem] w-[3.75rem] shrink-0 overflow-hidden rounded-xl bg-gray-100 sm:h-[4.25rem] sm:w-[4.25rem] ${
                    verificado ? 'ring-2 ring-[#0097b2]/15' : 'ring-2 ring-gray-200'
                  }`}
                >
                  {avatarUrl ? <Image src={avatarUrl} alt="" fill className="object-cover" sizes="68px" /> : null}
                </div>
                <div className="flex min-w-0 flex-col items-start justify-center gap-0.5 text-left">
                  <p className="line-clamp-2 max-w-[min(100%,18rem)] text-lg font-bold text-gray-900 sm:text-xl">
                    {nome || 'Profissional'}
                  </p>
                  <p className="max-w-[min(100%,18rem)] truncate text-sm font-normal text-gray-600 sm:text-base">
                    @{uShown || 'usuario'}
                  </p>
                </div>
              </div>
            </div>
            {verificado ? (
              <p className="w-full whitespace-normal px-1 text-center text-2xl font-bold leading-snug tracking-wide text-[#0097b2] sm:text-3xl">
                {rotuloCategoria}
              </p>
            ) : null}
          </div>

          {verificado ? (
            <div className="mt-6 w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-4">
              <p className="text-sm font-semibold text-gray-800">Nota de avaliação</p>
              <div className="mt-2 flex items-center justify-center gap-2">
                <Star className="h-5 w-5 fill-amber-400 text-amber-400" aria-hidden />
                <span className="text-xl font-bold text-gray-900">
                  {total ? media.toFixed(1).replace('.', ',') : '—'}
                </span>
                <span className="text-sm text-gray-500">({total} avaliações)</span>
              </div>
              <p className="mt-2 text-center text-xs text-gray-500">
                Avaliações serão habilitadas após a implementação da Mobilidade.
              </p>
            </div>
          ) : null}
        </div>

        {verificado ? (
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
        ) : null}
      </div>
    </div>
  )
}
