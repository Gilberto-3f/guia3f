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

/** @param {{ data: string, horario: string, pessoas: string | number }} p */
export function mensagemWhatsappReservaMesa({ data, horario, pessoas }) {
  return (
    `Olá!\n\n` +
    `Vi seu contato no Guia 3F e gostaria de reservar uma mesa no estabelecimento:\n\n` +
    `Data: *${data}*\n` +
    `Horário: *${horario}*\n` +
    `Pessoas: *${pessoas}*`
  )
}

export function mensagemWhatsappReservaMesaSimples() {
  return `Olá!\n\nVi seu contato no Guia 3F e gostaria de reservar uma mesa no estabelecimento.`
}

export function mensagemWhatsappContatoGuia() {
  return `Olá!\n\nVi seu contato no Guia 3F e gostaria de mais informações.`
}
