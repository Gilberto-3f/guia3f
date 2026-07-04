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
 * PY: 999-999999
 * @param {string} valor
 */
export function formatarTelefoneLocalPy(valor) {
  const digits = digitsWhatsapp(valor).slice(0, 9)
  if (!digits) return ''
  if (digits.length <= 3) return digits
  return `${digits.slice(0, 3)}-${digits.slice(3)}`
}

/**
 * AR: 9 9999 99-9999
 * @param {string} valor
 */
export function formatarTelefoneLocalAr(valor) {
  const digits = digitsWhatsapp(valor).slice(0, 11)
  if (!digits) return ''
  if (digits.length <= 1) return digits
  if (digits.length <= 5) return `${digits.slice(0, 1)} ${digits.slice(1)}`
  if (digits.length <= 7) return `${digits.slice(0, 1)} ${digits.slice(1, 5)} ${digits.slice(5)}`
  return `${digits.slice(0, 1)} ${digits.slice(1, 5)} ${digits.slice(5, 7)}-${digits.slice(7)}`
}

/**
 * @param {string} paisId
 * @param {string} valor
 */
export function formatarTelefoneLocal(paisId, valor) {
  if (paisId === 'br') return formatarTelefoneLocalBr(valor)
  if (paisId === 'py') return formatarTelefoneLocalPy(valor)
  if (paisId === 'ar') return formatarTelefoneLocalAr(valor)
  return digitsWhatsapp(valor)
}

/**
 * @param {string} paisId
 */
export function placeholderTelefoneLocal(paisId) {
  if (paisId === 'br') return '(00) 9 9999-9999'
  if (paisId === 'py') return '999-999999'
  if (paisId === 'ar') return '9 9999 99-9999'
  return undefined
}
