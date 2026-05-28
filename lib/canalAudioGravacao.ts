/** Safari/iOS não reproduz WebM de forma confiável no elemento audio HTML. */
export function navegadorPrefereAudioMp4(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const ios =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1)
  const safari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua)
  return ios || safari
}

/** MIME suportado pelo MediaRecorder (prioriza MP4 em iOS/Safari). */
export function mimeTypeGravacaoCanal(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  const candidatos = navegadorPrefereAudioMp4()
    ? ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/aac', 'audio/ogg;codecs=opus']
    : ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
  for (const m of candidatos) {
    if (MediaRecorder.isTypeSupported(m)) return m
  }
  return ''
}

/** Extensão de ficheiro coerente com o MIME gravado. */
export function extensaoAudioGravacao(mime: string): string {
  const m = mime.toLowerCase()
  if (m.includes('mp4') || m.includes('aac')) return 'm4a'
  if (m.includes('ogg')) return 'ogg'
  return 'webm'
}

/** contentType para upload no Storage. */
export function contentTypeUploadAudio(mime: string): string {
  const m = mime.toLowerCase()
  if (m.includes('mp4')) return 'audio/mp4'
  if (m.includes('webm')) return 'audio/webm'
  if (m.includes('ogg')) return 'audio/ogg'
  return mime || 'audio/webm'
}
