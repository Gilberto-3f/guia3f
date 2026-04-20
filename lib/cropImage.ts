/** Região em pixels da imagem original (x, y, largura, altura). */
export type PixelCrop = { x: number; y: number; width: number; height: number }

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.addEventListener('load', () => resolve(img))
    img.addEventListener('error', reject)
    img.src = src
  })
}

/**
 * Recorta e redimensiona para as dimensões finais do feed.
 */
export async function getCroppedImageBlob(
  imageSrc: string,
  pixelCrop: PixelCrop,
  outputWidth: number,
  outputHeight: number,
  mime: 'image/jpeg' | 'image/png' = 'image/jpeg',
  quality = 0.92
): Promise<Blob> {
  const image = await loadImage(imageSrc)
  const canvas = document.createElement('canvas')
  canvas.width = outputWidth
  canvas.height = outputHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D não disponível')

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputWidth,
    outputHeight
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar imagem'))), mime, quality)
  })
}
