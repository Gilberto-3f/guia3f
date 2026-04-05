/**
 * Data relativa para feed e comentários:
 * - menos de 1 h → minutos
 * - menos de 24 h → horas
 * - até 3 dias (contagem em dias) → "N dias"
 * - após isso → só data (dd/mm/aaaa)
 * @param {string | number | Date} dataISO
 * @returns {string}
 */
export function formatarDataRelativaPublicacao(dataISO) {
  const data = dataISO instanceof Date ? dataISO : new Date(dataISO)
  if (Number.isNaN(data.getTime())) return ''

  const agora = new Date()
  let diffMs = agora.getTime() - data.getTime()
  if (diffMs < 0) diffMs = 0

  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 60) {
    if (diffMin < 1) return 'Agora'
    return `${diffMin} minuto${diffMin === 1 ? '' : 's'}`
  }

  const diffHoras = Math.floor(diffMs / 3600000)
  if (diffHoras < 24) {
    return `${diffHoras} hora${diffHoras === 1 ? '' : 's'}`
  }

  const diffDias = Math.floor(diffMs / 86400000)
  if (diffDias < 4) {
    const d = Math.max(1, diffDias)
    return `${d} dia${d === 1 ? '' : 's'}`
  }

  return data.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}
