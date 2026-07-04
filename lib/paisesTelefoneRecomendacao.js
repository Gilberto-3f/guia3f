import { digitsWhatsapp } from '@/lib/whatsapp-empresa'

/** Países frequentes no turismo da tríplice fronteira + internacionais. */
export const PAISES_TELEFONE_RECOMENDACAO = [
  { id: 'br', bandeira: '🇧🇷', nome: 'Brasil', ddi: '55', placeholder: '(00) 9 9999-9999' },
  { id: 'py', bandeira: '🇵🇾', nome: 'Paraguai', ddi: '595', placeholder: '999-999999' },
  { id: 'ar', bandeira: '🇦🇷', nome: 'Argentina', ddi: '54', placeholder: '9 9999 99-9999' },
  { id: 'us', bandeira: '🇺🇸', nome: 'EUA', ddi: '1', placeholder: '(555) 123-4567' },
  { id: 'uy', bandeira: '🇺🇾', nome: 'Uruguai', ddi: '598', placeholder: '99 123 456' },
  { id: 'cl', bandeira: '🇨🇱', nome: 'Chile', ddi: '56', placeholder: '9 1234 5678' },
]

/**
 * @param {string} ddi
 * @param {string} local
 */
export function montarTelefoneComDdi(ddi, local) {
  const code = digitsWhatsapp(ddi)
  const num = digitsWhatsapp(local)
  if (!code || !num) return ''
  if (num.startsWith(code)) return num
  return `${code}${num}`
}

/**
 * @param {string} id
 */
export function paisTelefonePorId(id) {
  return PAISES_TELEFONE_RECOMENDACAO.find((p) => p.id === id) ?? PAISES_TELEFONE_RECOMENDACAO[0]
}
