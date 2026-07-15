'use client'

/**
 * Hub Compras CDE — Fase 1: placeholder.
 * Fase 3 implementa cotações, filtros, feed de mini-cards e comparador.
 */
export default function ComprasCdePage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-gray-50">
      <header className="shrink-0 border-b border-white/15 bg-[#0097b2] px-4 py-4 pt-safe">
        <h1 className="flex items-center justify-center gap-2 text-lg font-bold tracking-wide text-white">
          <span className="inline-flex overflow-hidden rounded-sm border border-white/80 text-xl leading-none" aria-hidden>
            🇵🇾
          </span>
          Compras CDE
          <span className="inline-flex overflow-hidden rounded-sm border border-white/80 text-xl leading-none" aria-hidden>
            🇵🇾
          </span>
        </h1>
        <p className="mt-1 text-center text-xs text-white/85">Compare preços e economize</p>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center">
        <p className="text-sm font-semibold text-[#001f3f]">Hub em construção</p>
        <p className="max-w-sm text-sm text-gray-500">
          O comparador de preços e o feed de produtos chegam na próxima fase. Empresas Lojas CDE já podem cadastrar
          produtos em <span className="font-semibold">Botão Dinâmico</span>.
        </p>
      </main>
    </div>
  )
}
