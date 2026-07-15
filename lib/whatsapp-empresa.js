/**
 * Digits-only for wa.me (sem +).
 * @param {string | null | undefined} raw
 * @returns {string}
 */
export function digitsWhatsapp(raw) {
  if (!raw) return ''
  const d = String(raw).replace(/\D/g, '')
  return d
}

/**
 * @param {string | null | undefined} raw
 */
export function whatsappWaUrl(raw) {
  const d = digitsWhatsapp(raw)
  if (d) return d
  const fallback = process.env.NEXT_PUBLIC_WHATSAPP_EMPRESAS_DEFAULT
  return fallback ? digitsWhatsapp(fallback) : ''
}

/**
 * URL web oficial (api.whatsapp.com abre WhatsApp ou WhatsApp Business instalado).
 * @param {string} phoneDigits
 * @param {string} [message]
 */
export function whatsappWebSendUrl(phoneDigits, message = '') {
  const text = message ? encodeURIComponent(message) : ''
  return text
    ? `https://api.whatsapp.com/send?phone=${phoneDigits}&text=${text}`
    : `https://api.whatsapp.com/send?phone=${phoneDigits}`
}

/**
 * Abre conversa no WhatsApp (pessoal ou Business).
 * wa.me costuma resolver só o app consumer; api.whatsapp.com + intent/deep link
 * delegam ao app instalado (qualquer um).
 * @param {string | null | undefined} rawPhone
 * @param {string} [message]
 * @returns {boolean} false se telefone inválido
 */
export function openWhatsAppChat(rawPhone, message = '') {
  const phone = whatsappWaUrl(rawPhone)
  if (!phone) return false

  const webUrl = whatsappWebSendUrl(phone, message)

  if (typeof window === 'undefined') return true

  const ua = navigator.userAgent || ''
  const isAndroid = /Android/i.test(ua)
  const isIOS = /iPhone|iPad|iPod/i.test(ua)

  if (isAndroid) {
    const textParam = message ? encodeURIComponent(message) : ''
    const fallback = encodeURIComponent(webUrl)
    const intent = textParam
      ? `intent://send/?phone=${phone}&text=${textParam}#Intent;scheme=whatsapp;action=android.intent.action.VIEW;S.browser_fallback_url=${fallback};end`
      : `intent://send/?phone=${phone}#Intent;scheme=whatsapp;action=android.intent.action.VIEW;S.browser_fallback_url=${fallback};end`
    window.location.href = intent
    return true
  }

  if (isIOS) {
    const textParam = message ? encodeURIComponent(message) : ''
    const deepLink = textParam
      ? `whatsapp://send?phone=${phone}&text=${textParam}`
      : `whatsapp://send?phone=${phone}`
    window.location.href = deepLink
    return true
  }

  window.open(webUrl, '_blank', 'noopener,noreferrer')
  return true
}

/** @param {string} username */
function handlePagina(username) {
  const u = String(username ?? '').trim().replace(/^@+/, '')
  return u ? `@${u}` : ''
}

/** Converte yyyy-mm-dd (input date) ou texto livre para dd/mm. */
export function formatarDataReservaBr(valor) {
  const v = String(valor ?? '').trim()
  if (!v) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [, mm, dd] = v.split('-')
    return `${dd}/${mm}`
  }
  return v
}

/** @param {{ username?: string | null, data: string, horario: string, pessoas: number | string }} p */
export function mensagemWhatsappReservaMesa({ username, data, horario, pessoas }) {
  const h = handlePagina(username)
  const qtd = Math.max(1, Number(pessoas) || 1)
  const dataFmt = formatarDataReservaBr(data)
  return (
    `Olá ${h}!\n\n` +
    `Vi sua página no Guia 3F e gostaria de reservar uma mesa no estabelecimento:\n\n` +
    `Data: *${dataFmt}*\n` +
    `Horário: *${horario}*\n` +
    `Mesa para: *${qtd} pessoas*`
  )
}

/** @param {string | null | undefined} username */
export function mensagemWhatsappReservaMesaSimples(username) {
  const h = handlePagina(username)
  return `Olá ${h}!\n\nVi sua página no Guia 3F e gostaria de reservar uma mesa no estabelecimento.`
}

export function mensagemWhatsappContatoGuia() {
  return `Olá!\n\nVi seu contato no Guia 3F e gostaria de mais informações.`
}

/**
 * Interesse em produto (Compras CDE / catálogo Lojas CDE).
 * @param {{ nomeProduto?: string, username?: string | null }} [opts]
 */
export function mensagemWhatsappProduto(opts = {}) {
  const nomeProduto = String(opts.nomeProduto ?? '').trim()
  const user = opts.username ? String(opts.username).replace(/^@/, '') : ''
  const handle = user ? `@${user}` : ''
  if (nomeProduto) {
    return (
      `Olá${handle ? ` ${handle}` : ''}!\n\n` +
      `Vi o produto *${nomeProduto}* no Guia 3F (Compras CDE) e gostaria de mais informações.`
    )
  }
  return `Olá${handle ? ` ${handle}` : ''}!\n\nVi seus produtos no Guia 3F (Compras CDE) e gostaria de mais informações.`
}

/**
 * Mensagem de indicação de atrativo para turista (link gera preview via Open Graph).
 * @param {{
 *   empresaNome: string
 *   empresaUrl: string
 *   profissionalUsername?: string | null
 *   profissionalCategorias?: string[] | null
 *   nota?: number | null
 *   totalAvaliacoes?: number | null
 *   categoria?: string | null
 *   endereco?: string | null
 *   username?: string | null
 * }} p
 */
/**
 * Mensagem de indicação de profissional para turista (cartão de visita).
 * @param {{
 *   profissionalNome: string
 *   profissionalUrl: string
 *   indicadorUsername?: string | null
 *   indicadorCategorias?: string[] | null
 *   nota?: number | null
 *   totalAvaliacoes?: number | null
 *   categoria?: string | null
 *   username?: string | null
 *   paisBandeira?: string | null
 * }} p
 */
export function mensagemWhatsappRecomendacaoProfissional({
  profissionalNome,
  profissionalUrl,
  indicadorUsername,
  nota,
  totalAvaliacoes,
  categoria,
  username,
  paisBandeira,
}) {
  const lines = [`Olá! Recomendo o(a) profissional *${profissionalNome}* para você...`, '', profissionalUrl]

  const notaNum = nota != null && Number.isFinite(Number(nota)) ? Number(nota) : null
  const total = totalAvaliacoes != null && Number.isFinite(Number(totalAvaliacoes)) ? Number(totalAvaliacoes) : null
  const rating = notaNum != null ? `${notaNum.toFixed(1)}★${total ? ` (${total})` : ''}` : ''
  const meta = [rating, categoria ? String(categoria) : ''].filter(Boolean).join(' · ')
  if (meta) lines.push(meta)

  const handle = username ? handlePagina(username) : ''
  if (handle) {
    const bandeira = paisBandeira ? `${String(paisBandeira)} ` : ''
    lines.push(`${bandeira}${handle}`)
  }

  const indHandle = indicadorUsername ? handlePagina(indicadorUsername) : ''
  if (indHandle) {
    lines.push('', `Indicação do(a) profissional *${indHandle}* (personal shopper - 3F Guia Turístico).`)
  }

  return lines.join('\n')
}

export function mensagemWhatsappRecomendacao({
  empresaNome,
  empresaUrl,
  profissionalUsername,
  profissionalCategorias,
  nota,
  totalAvaliacoes,
  categoria,
  endereco,
  username,
}) {
  const lines = [`Olá! Recomendo *${empresaNome}* para você...`, '', empresaUrl]

  const notaNum = nota != null && Number.isFinite(Number(nota)) ? Number(nota) : null
  const total = totalAvaliacoes != null && Number.isFinite(Number(totalAvaliacoes)) ? Number(totalAvaliacoes) : null
  const rating = notaNum != null ? `${notaNum.toFixed(1)}★${total ? ` (${total})` : ''}` : ''
  const meta = [rating, categoria ? String(categoria) : ''].filter(Boolean).join(' · ')
  if (meta) lines.push(meta)

  const handle = username ? handlePagina(username) : ''
  if (handle) lines.push(handle)

  if (endereco) lines.push(String(endereco))

  const profHandle = profissionalUsername ? handlePagina(profissionalUsername) : ''
  if (profHandle) {
    lines.push('', `Indicação do(a) profissional *${profHandle}* (personal shopper - 3F Guia Turístico).`)
  }

  return lines.join('\n')
}
