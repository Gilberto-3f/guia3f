'use client'

/**
 * Fundo da aba FOTO em /feed/criar: gradiente vertical azul-bebé suave + halos radiais (efeito “desfocado”).
 */
export default function CriarFotoDreamBackdrop() {
  return (
    <>
      {/* `fixed` cobre sempre o viewport (o contentor da página pode ser `min-h-0` no hero sem preview). */}
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-[#f8fcff] from-[8%] via-[#eaf4fb] via-[38%] via-[#dff0fa] via-[68%] to-[#d0e8f6]"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_110%_70%_at_50%_-5%,rgba(255,255,255,0.78),transparent_52%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_95%_60%_at_50%_105%,rgba(160,198,230,0.2),transparent_55%)]"
        aria-hidden
      />
    </>
  )
}
