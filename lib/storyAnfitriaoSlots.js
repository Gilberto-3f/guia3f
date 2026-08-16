/** Chave de slot na barra de stories: separa perfil social (prof) da página empresa (emp). */

/**
 * @param {unknown} autorId
 * @param {boolean} ehEmpresa
 */
export function storySlotKeyFromAutorPersona(autorId, ehEmpresa) {
  const aid = String(autorId ?? '').trim()
  if (!aid) return ''
  return ehEmpresa ? `${aid}|emp` : `${aid}|prof`
}

/**
 * @param {{ autor_id?: unknown, autor_tipo?: unknown }} story
 */
export function storySlotKeyFromRow(story) {
  const aid = String(story?.autor_id ?? '').trim()
  if (!aid) return ''
  const emp = String(story?.autor_tipo ?? '').toLowerCase() === 'empresa'
  return storySlotKeyFromAutorPersona(aid, emp)
}

/** @param {string} slot */
export function autorIdFromStorySlot(slot) {
  const s = String(slot ?? '').trim()
  const i = s.indexOf('|')
  return i >= 0 ? s.slice(0, i) : s
}

/** @param {string} slot */
export function storySlotEhEmpresa(slot) {
  return String(slot ?? '').endsWith('|emp')
}

/**
 * @param {{ autor_tipo?: unknown } | null | undefined} row
 * @param {boolean} slotEmpresa
 */
export function storyRowCombinaSlot(row, slotEmpresa) {
  const emp = String(row?.autor_tipo ?? '').toLowerCase() === 'empresa'
  return slotEmpresa ? emp : !emp
}
