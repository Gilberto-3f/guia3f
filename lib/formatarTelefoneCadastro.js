import { digitsWhatsapp } from '@/lib/whatsapp-empresa'

/**
 * Máscara BR: (XX) X XXXX-XXXX — parênteses fixos no DDD.
 * @param {string} valor
 */
export function formatarTelefoneLocalBr(valor) {
  const digits = digitsWhatsapp(valor).slice(0, 11)
  if (!digits) return ''

  if (digits.length <= 2) {
    return `(${digits}`
  }

  const ddd = digits.slice(0, 2)
  const rest = digits.slice(2)
  let formatted = `(${ddd}) `

  if (!rest) return formatted.trimEnd()

  if (rest.length <= 1) {
    return formatted + rest
  }

  if (rest.length <= 5) {
    return formatted + rest.slice(0, 1) + (rest.length > 1 ? ` ${rest.slice(1)}` : '')
  }

  return `${formatted}${rest.slice(0, 1)} ${rest.slice(1, 5)}-${rest.slice(5)}`
}

/**
 * @param {string} paisId
 * @param {string} valor
 */
export function formatarTelefoneLocal(paisId, valor) {
  if (paisId === 'br') return formatarTelefoneLocalBr(valor)
  return digitsWhatsapp(valor)
}

/**
 * @param {string} paisId
 */
export function placeholderTelefoneLocal(paisId) {
  if (paisId === 'br') return '(00) 0 0000-0000'
  return undefined
}
