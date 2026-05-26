/**
 * Separadores de data no chat (estilo WhatsApp).
 */

function chaveDia(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

export function rotuloSeparadorDataMensagem(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''

  const hoje = new Date()
  const ontem = new Date(hoje)
  ontem.setDate(ontem.getDate() - 1)

  if (d.toDateString() === hoje.toDateString()) return 'Hoje'
  if (d.toDateString() === ontem.toDateString()) return 'Ontem'

  const weekday = d
    .toLocaleDateString('pt-BR', { weekday: 'short' })
    .replace(/\.$/, '')
    .toLowerCase()
  const day = d.getDate()
  const month = d
    .toLocaleDateString('pt-BR', { month: 'short' })
    .replace(/\.$/, '')
    .toLowerCase()

  return `${weekday}., ${day} de ${month}.`
}

export type ItemListaMensagemComData<T> =
  | { type: 'date'; key: string; label: string }
  | { type: 'msg'; msg: T }

export function mensagensComSeparadoresData<T>(
  mensagens: T[],
  getCreatedAt: (m: T) => string,
): ItemListaMensagemComData<T>[] {
  const items: ItemListaMensagemComData<T>[] = []
  let lastDay = ''

  for (const msg of mensagens) {
    const iso = getCreatedAt(msg)
    const day = chaveDia(iso)
    if (day && day !== lastDay) {
      items.push({
        type: 'date',
        key: `date-${day}`,
        label: rotuloSeparadorDataMensagem(iso),
      })
      lastDay = day
    }
    items.push({ type: 'msg', msg })
  }

  return items
}
