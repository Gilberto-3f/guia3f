import { digitsWhatsapp } from '@/lib/whatsapp-empresa'
import { PAISES_TELEFONE_RECOMENDACAO, paisTelefonePorId } from '@/lib/paisesTelefoneRecomendacao'

/** Exemplos de formato por país (tríplice fronteira). */
export const FORMATOS_TELEFONE_TRIPLICE = [
  { id: 'br', bandeira: '🇧🇷', nome: 'Brasil', exemplo: '+55 (xx) 9 9999-9999' },
  { id: 'py', bandeira: '🇵🇾', nome: 'Paraguai', exemplo: '+595 999-999999' },
  { id: 'ar', bandeira: '🇦🇷', nome: 'Argentina', exemplo: '+54 9 9999 99-9999' },
]

/**
 * @param {string} digits
 * @returns {string | null}
 */
export function inferirPaisIdTelefone(digits) {
  const d = digitsWhatsapp(digits)
  if (!d) return null
  const ordenados = [...PAISES_TELEFONE_RECOMENDACAO].sort((a, b) => b.ddi.length - a.ddi.length)
  for (const p of ordenados) {
    if (d.startsWith(p.ddi) && d.length > p.ddi.length) return p.id
  }
  if (d.length === 10 || d.length === 11) return 'br'
  return null
}

/**
 * @param {string | null | undefined} paisId
 */
export function bandeiraTelefoneExibicao(paisId) {
  if (!paisId) return ''
  return paisTelefonePorId(paisId).bandeira
}

/**
 * @param {string} localDigits
 */
function formatarBrLocal(localDigits) {
  const d = digitsWhatsapp(localDigits)
  if (!d) return ''
  if (d.length === 11) {
    return `+55 (${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`
  }
  if (d.length === 10) {
    return `+55 (${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  }
  if (d.length > 2) {
    return `+55 (${d.slice(0, 2)}) ${d.slice(2)}`
  }
  return `+55 ${d}`
}

/**
 * @param {string} localDigits
 */
function formatarPyLocal(localDigits) {
  const d = digitsWhatsapp(localDigits)
  if (!d) return ''
  if (d.length >= 6) return `+595 ${d.slice(0, 3)}-${d.slice(3)}`
  return `+595 ${d}`
}

/**
 * @param {string} localDigits
 */
function formatarArLocal(localDigits) {
  const d = digitsWhatsapp(localDigits)
  if (!d) return ''
  if (d.length >= 10) {
    return `+54 ${d.slice(0, 1)} ${d.slice(1, 5)} ${d.slice(5, 7)}-${d.slice(7, 11)}`
  }
  if (d.length >= 6) {
    return `+54 ${d.slice(0, 1)} ${d.slice(1, 5)} ${d.slice(5)}`
  }
  return `+54 ${d}`
}

/**
 * @param {string} paisId
 * @param {string} digitsComDdi
 */
function formatarPorPais(paisId, digitsComDdi) {
  const d = digitsWhatsapp(digitsComDdi)
  const p = paisTelefonePorId(paisId)
  const local = d.startsWith(p.ddi) ? d.slice(p.ddi.length) : d
  if (paisId === 'br') return formatarBrLocal(local)
  if (paisId === 'py') return formatarPyLocal(local)
  if (paisId === 'ar') return formatarArLocal(local)
  return local ? `+${p.ddi} ${local}` : `+${p.ddi}`
}

/**
 * Formata telefone para exibição na aba Endereço (bandeira + número).
 * @param {string | null | undefined} raw
 * @param {{ cidadeFallback?: string | null }} [opts]
 * @returns {{ texto: string, bandeira: string, paisId: string | null, digits: string }}
 */
export function formatarTelefoneExibicao(raw, opts = {}) {
  const digits = digitsWhatsapp(raw)
  if (!digits) {
    return { texto: '', bandeira: '', paisId: null, digits: '' }
  }

  let paisId = inferirPaisIdTelefone(digits)
  if (!paisId && opts.cidadeFallback) {
    const c = String(opts.cidadeFallback).toLowerCase()
    if (c.includes('foz')) paisId = 'br'
    else if (c.includes('ciudad del este') || c.includes('cde')) paisId = 'py'
    else if (c.includes('puerto iguazu') || c.includes('iguazu')) paisId = 'ar'
  }
  if (!paisId) paisId = 'br'

  const texto = formatarPorPais(paisId, digits)
  return {
    texto,
    bandeira: bandeiraTelefoneExibicao(paisId),
    paisId,
    digits,
  }
}
