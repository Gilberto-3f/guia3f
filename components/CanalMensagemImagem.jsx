'use client'

/**
 * Anexo de imagem em mensagem de canal — `<img>` nativo para URLs do Supabase Storage (evita falha do `next/image`).
 * @param {{ src: string; className?: string }} props
 */
export default function CanalMensagemImagem({ src, className = '' }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className={`max-h-52 w-full max-w-[220px] rounded-lg object-cover ${className}`}
      loading="lazy"
      decoding="async"
    />
  )
}
