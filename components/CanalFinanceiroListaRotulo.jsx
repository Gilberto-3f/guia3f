'use client'

export const TITULO_CANAL_FINANCEIRO_PESSOAL = 'Seu Canal Financeiro'

/**
 * @param {string | null | undefined} nomeUsuario
 */
export function formatUsernameCanalFinanceiro(nomeUsuario) {
  const raw = String(nomeUsuario ?? '').trim()
  if (!raw) return null
  return raw.startsWith('@') ? raw : `@${raw}`
}

/**
 * Título do canal financeiro particular (lista + cabeçalho).
 * @param {{
 *   username?: string | null
 *   inverse?: boolean
 *   className?: string
 * }} props
 */
export default function CanalFinanceiroListaRotulo({
  username = null,
  inverse = false,
  className = '',
}) {
  const handle = formatUsernameCanalFinanceiro(username)
  const titleClass = inverse
    ? 'truncate text-base font-semibold leading-snug text-white'
    : 'truncate text-[15px] font-normal leading-snug text-gray-800'
  const subClass = inverse
    ? 'truncate text-xs font-normal leading-snug text-white/85'
    : 'truncate text-xs font-normal leading-snug text-gray-500'

  return (
    <div className={`min-w-0 ${className}`.trim()}>
      <div className={titleClass}>{TITULO_CANAL_FINANCEIRO_PESSOAL}</div>
      {handle ? <div className={subClass}>{handle}</div> : null}
    </div>
  )
}
