/**
 * Redimensiona e comprime imagem para upload de story (menos bytes = publicação mais rápida).
 * @param {File} file
 * @param {{ maxWidth?: number, jpegQuality?: number, maxBytesSkip?: number }} [opts]
 * @returns {Promise<File>}
 */
export async function compressImageFileForStoryUpload(file, opts = {}) {
  const maxWidth = opts.maxWidth ?? 1080
  const jpegQuality = opts.jpegQuality ?? 0.82
  const maxBytesSkip = opts.maxBytesSkip ?? 350_000
  if (!file.type.startsWith('image/')) return file
  if (file.size <= maxBytesSkip && file.type === 'image/jpeg') {
    try {
      const bmp = await createImageBitmap(file)
      const ok = bmp.width <= maxWidth
      bmp.close?.()
      if (ok) return file
    } catch {
      return file
    }
  }

  let bmp
  try {
    bmp = await createImageBitmap(file)
  } catch {
    return file
  }

  try {
    const w = bmp.width
    const h = bmp.height
    const scale = w > maxWidth ? maxWidth / w : 1
    const tw = Math.max(1, Math.round(w * scale))
    const th = Math.max(1, Math.round(h * scale))

    const canvas = document.createElement('canvas')
    canvas.width = tw
    canvas.height = th
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bmp, 0, 0, tw, th)
    bmp.close?.()

    const blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', jpegQuality)
    })
    if (!blob || blob.size === 0) return file
    if (blob.size >= file.size && file.size < 900_000) return file

    return new File([blob], 'story.jpg', { type: 'image/jpeg', lastModified: Date.now() })
  } catch {
    try {
      bmp.close?.()
    } catch {
      /* ignore */
    }
    return file
  }
}
