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

export function mensagemWhatsappContatoGuia() {
  return `Olá!\n\nVi seu contato no Guia 3F e gostaria de mais informações.`
}

/**
 * Interesse em produto (Compras CDE / catálogo Lojas CDE).
 * Inclua `produtoUrl` para o WhatsApp gerar preview com a foto de capa (Open Graph).
 * @param {{ nomeProduto?: string, username?: string | null, produtoUrl?: string | null }} [opts]
 */
export function mensagemWhatsappProduto(opts = {}) {
  const nomeProduto = String(opts.nomeProduto ?? '').trim()
  const user = opts.username ? String(opts.username).replace(/^@/, '') : ''
  const handle = user ? `@${user}` : ''
  const produtoUrl = opts.produtoUrl ? String(opts.produtoUrl).trim() : ''

  const lines = []
  if (nomeProduto) {
    lines.push(
      `Olá${handle ? ` ${handle}` : ''}!\n\nVi o produto *${nomeProduto}* no Guia 3F (Compras CDE) e gostaria de mais informações.`,
    )
  } else {
    lines.push(
      `Olá${handle ? ` ${handle}` : ''}!\n\nVi seus produtos no Guia 3F (Compras CDE) e gostaria de mais informações.`,
    )
  }
  if (produtoUrl) {
    lines.push('', produtoUrl)
  }
  return lines.join('\n')
}

/**
 * Contato WhatsApp a partir do detalhe de um prato do cardápio digital.
 * @param {{ nomePrato?: string, username?: string | null, pratoUrl?: string | null }} [opts]
 */
export function mensagemWhatsappPrato(opts = {}) {
  const nomePrato = String(opts.nomePrato ?? '').trim()
  const user = opts.username ? String(opts.username).replace(/^@/, '') : ''
  const handle = user ? `@${user}` : ''
  const pratoUrl = opts.pratoUrl ? String(opts.pratoUrl).trim() : ''

  const lines = []
  if (nomePrato) {
    lines.push(
      `Olá${handle ? ` ${handle}` : ''}!\n\nVi o prato *${nomePrato}* no cardápio digital do Guia 3F e gostaria de mais informações.`,
    )
  } else {
    lines.push(
      `Olá${handle ? ` ${handle}` : ''}!\n\nVi o cardápio digital no Guia 3F e gostaria de mais informações.`,
    )
  }
  if (pratoUrl) {
    lines.push('', pratoUrl)
  }
  return lines.join('\n')
}

/**
 * Contato WhatsApp a partir do detalhe de um serviço local.
 * @param {{ nomeServico?: string, username?: string | null, servicoUrl?: string | null }} [opts]
 */
export function mensagemWhatsappServico(opts = {}) {
  const nomeServico = String(opts.nomeServico ?? '').trim()
  const user = opts.username ? String(opts.username).replace(/^@/, '') : ''
  const handle = user ? `@${user}` : ''
  const servicoUrl = opts.servicoUrl ? String(opts.servicoUrl).trim() : ''

  const lines = []
  if (nomeServico) {
    lines.push(
      `Olá${handle ? ` ${handle}` : ''}!\n\nVi o serviço *${nomeServico}* no Guia 3F e gostaria de mais informações.`,
    )
  } else {
    lines.push(
      `Olá${handle ? ` ${handle}` : ''}!\n\nVi os serviços no Guia 3F e gostaria de mais informações.`,
    )
  }
  if (servicoUrl) {
    lines.push('', servicoUrl)
  }
  return lines.join('\n')
}

/**
 * Recomendação de produto do comparador Compras CDE (profissional → turista).
 * @param {{
 *   produtoNome: string
 *   produtoUrl: string
 *   precoUsd?: number | null
 *   precoBrl?: number | null
 *   empresaNome?: string | null
 *   empresaUsername?: string | null
 *   profissionalUsername?: string | null
 * }} p
 */
export function mensagemWhatsappRecomendacaoProduto({
  produtoNome,
  produtoUrl,
  precoUsd,
  precoBrl,
  empresaNome,
  empresaUsername,
  profissionalUsername,
}) {
  const lines = [
    `Olá! Recomendo o produto *${produtoNome}* que está no comparador de preços Compras CDE do Guia 3F...`,
    '',
    produtoUrl,
  ]

  const usd = precoUsd != null && Number.isFinite(Number(precoUsd)) ? Number(precoUsd) : null
  const brl = precoBrl != null && Number.isFinite(Number(precoBrl)) ? Number(precoBrl) : null
  const precos = [
    usd != null ? `US$ ${usd.toFixed(2)}` : '',
    brl != null && brl > 0
      ? `R$ ${brl.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (cotação do dia)`
      : '',
  ]
    .filter(Boolean)
    .join(' · ')
  if (precos) lines.push(precos)

  const lojaHandle = empresaUsername ? handlePagina(empresaUsername) : ''
  const loja = [empresaNome ? String(empresaNome) : '', lojaHandle].filter(Boolean).join(' ')
  if (loja) lines.push(`Loja: ${loja}`)

  const profHandle = profissionalUsername ? handlePagina(profissionalUsername) : ''
  if (profHandle) {
    lines.push('', `Indicação do(a) profissional *${profHandle}* (personal shopper - 3F Guia Turístico).`)
  }

  return lines.join('\n')
}

/**
 * Recomendação de prato do cardápio digital (gastronomia) (profissional → turista).
 * @param {{
 *   pratoNome: string
 *   pratoUrl: string
 *   precoUsd?: number | null
 *   precoBrl?: number | null
 *   empresaNome?: string | null
 *   empresaUsername?: string | null
 *   profissionalUsername?: string | null
 * }} p
 */
export function mensagemWhatsappRecomendacaoPrato({
  pratoNome,
  pratoUrl,
  precoUsd,
  precoBrl,
  empresaNome,
  empresaUsername,
  profissionalUsername,
}) {
  const lines = [
    `Olá! Recomendo o prato *${pratoNome}* que está no cardápio digital do Guia 3F...`,
    '',
    pratoUrl,
  ]

  const usd = precoUsd != null && Number.isFinite(Number(precoUsd)) ? Number(precoUsd) : null
  const brl = precoBrl != null && Number.isFinite(Number(precoBrl)) ? Number(precoBrl) : null
  const precos = [
    usd != null ? `US$ ${usd.toFixed(2)}` : '',
    brl != null && brl > 0
      ? `R$ ${brl.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (cotação do dia)`
      : '',
  ]
    .filter(Boolean)
    .join(' · ')
  if (precos) lines.push(precos)

  const restauranteHandle = empresaUsername ? handlePagina(empresaUsername) : ''
  const restaurante = [empresaNome ? String(empresaNome) : '', restauranteHandle].filter(Boolean).join(' ')
  if (restaurante) lines.push(`Restaurante: ${restaurante}`)

  const profHandle = profissionalUsername ? handlePagina(profissionalUsername) : ''
  if (profHandle) {
    lines.push('', `Indicação do(a) profissional *${profHandle}* (personal shopper - 3F Guia Turístico).`)
  }

  return lines.join('\n')
}

/**
 * Recomendação de serviço local (profissional → turista).
 * @param {{
 *   servicoNome: string
 *   servicoUrl: string
 *   precoUsd?: number | null
 *   precoBrl?: number | null
 *   empresaNome?: string | null
 *   empresaUsername?: string | null
 *   profissionalUsername?: string | null
 * }} p
 */
export function mensagemWhatsappRecomendacaoServico({
  servicoNome,
  servicoUrl,
  precoUsd,
  precoBrl,
  empresaNome,
  empresaUsername,
  profissionalUsername,
}) {
  const lines = [
    `Olá! Recomendo o serviço *${servicoNome}* que está no Guia 3F...`,
    '',
    servicoUrl,
  ]

  const usd = precoUsd != null && Number.isFinite(Number(precoUsd)) ? Number(precoUsd) : null
  const brl = precoBrl != null && Number.isFinite(Number(precoBrl)) ? Number(precoBrl) : null
  const precos = [
    usd != null ? `US$ ${usd.toFixed(2)}` : '',
    brl != null && brl > 0
      ? `R$ ${brl.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (cotação do dia)`
      : '',
  ]
    .filter(Boolean)
    .join(' · ')
  if (precos) lines.push(precos)

  const empresaHandle = empresaUsername ? handlePagina(empresaUsername) : ''
  const empresa = [empresaNome ? String(empresaNome) : '', empresaHandle].filter(Boolean).join(' ')
  if (empresa) lines.push(`Empresa: ${empresa}`)

  const profHandle = profissionalUsername ? handlePagina(profissionalUsername) : ''
  if (profHandle) {
    lines.push('', `Indicação do(a) profissional *${profHandle}* (personal shopper - 3F Guia Turístico).`)
  }

  return lines.join('\n')
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
