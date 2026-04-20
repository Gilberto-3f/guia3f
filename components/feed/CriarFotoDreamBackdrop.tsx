'use client'

/**
 * Fundo “etéreo” da aba FOTO em /feed/criar: gradiente pastel + muitos radiais (bokeh)
 * + ruído SVG (brilho fino). Tudo `pointer-events-none`; empilhar atrás do conteúdo com `-z-10`.
 */
export default function CriarFotoDreamBackdrop() {
  const bokeh = [
    'radial-gradient(ellipse 120% 90% at 50% -5%, rgba(255,255,255,0.92) 0%, transparent 52%)',
    'radial-gradient(ellipse 70% 55% at 12% 35%, rgba(255,255,255,0.55) 0%, transparent 50%)',
    'radial-gradient(ellipse 50% 45% at 88% 28%, rgba(255,255,255,0.5) 0%, transparent 48%)',
    'radial-gradient(circle 120px at 22% 72%, rgba(255,220,235,0.42) 0%, transparent 62%)',
    'radial-gradient(circle 95px at 78% 68%, rgba(200,230,255,0.38) 0%, transparent 58%)',
    'radial-gradient(circle 180px at 55% 45%, rgba(255,255,255,0.28) 0%, transparent 55%)',
    'radial-gradient(ellipse 140px 100px at 8% 88%, rgba(237,200,230,0.35) 0%, transparent 60%)',
    'radial-gradient(ellipse 160px 120px at 92% 82%, rgba(220,210,255,0.32) 0%, transparent 58%)',
    'radial-gradient(circle 70px at 40% 18%, rgba(186,230,253,0.45) 0%, transparent 52%)',
    'radial-gradient(circle 55px at 65% 12%, rgba(255,255,255,0.65) 0%, transparent 45%)',
    'radial-gradient(circle 85px at 30% 55%, rgba(255,245,250,0.4) 0%, transparent 50%)',
    'radial-gradient(circle 65px at 70% 52%, rgba(230,240,255,0.38) 0%, transparent 48%)',
    'radial-gradient(ellipse 200px 90px at 50% 92%, rgba(245,210,225,0.45) 0%, transparent 55%)',
    'radial-gradient(circle 45px at 48% 38%, rgba(255,255,255,0.55) 0%, transparent 42%)',
    'radial-gradient(circle 38px at 15% 48%, rgba(255,255,255,0.35) 0%, transparent 40%)',
    'radial-gradient(circle 52px at 85% 44%, rgba(200,220,255,0.32) 0%, transparent 44%)',
    'radial-gradient(circle 28px at 62% 78%, rgba(255,255,255,0.5) 0%, transparent 38%)',
    'radial-gradient(circle 34px at 25% 88%, rgba(255,255,255,0.4) 0%, transparent 36%)',
    'radial-gradient(circle 40px at 90% 15%, rgba(255,255,255,0.45) 0%, transparent 40%)',
    'radial-gradient(circle 22px at 75% 35%, rgba(255,255,255,0.55) 0%, transparent 35%)',
  ].join(', ')

  return (
    <>
      {/* Base pastel (cobre o gradiente “creme” do pai para esta aba) */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-white via-[#e8f0fb] via-45% via-[#ebe8f6] via-70% to-[#f3e6ee]"
        aria-hidden
      />
      {/* Bokeh — muitos radiais sobrepostos */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ backgroundImage: bokeh }}
        aria-hidden
      />
      {/* Brilho fino — ruído fractal em soft-light */}
      <svg
        className="pointer-events-none absolute inset-0 -z-10 h-full min-h-[100dvh] w-full opacity-[0.14] mix-blend-soft-light"
        aria-hidden
        preserveAspectRatio="none"
        viewBox="0 0 512 512"
      >
        <defs>
          <filter id="criar-foto-glitter" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" seed="7" result="n" />
            <feColorMatrix in="n" type="saturate" values="0" />
          </filter>
        </defs>
        <rect width="512" height="512" filter="url(#criar-foto-glitter)" />
      </svg>
      {/* Véu suave para unificar e não competir com o conteúdo */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-white/25 via-transparent to-white/20"
        aria-hidden
      />
    </>
  )
}
