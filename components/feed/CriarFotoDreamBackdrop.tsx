'use client'

import Image from 'next/image'

/**
 * Fundo da aba FOTO em /feed/criar: WebP otimizado (`public/feed/criar-foto-bg.webp`)
 * + véu leve para legibilidade. Regenerar: `node scripts/generate-criar-foto-bg.mjs`
 */
export default function CriarFotoDreamBackdrop() {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 -z-10 min-h-[100dvh] w-full"
        aria-hidden
      >
        <div className="relative h-full min-h-[100dvh] w-full">
          <Image
            src="/feed/criar-foto-bg.webp"
            alt=""
            fill
            className="object-cover object-center"
            sizes="100vw"
            quality={78}
            priority={false}
          />
        </div>
      </div>
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-white/30 via-white/12 to-white/28"
        aria-hidden
      />
    </>
  )
}
