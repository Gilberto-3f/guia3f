/** Evita manter a página anterior visível durante a navegação do menu. */
export default function BotaoDinamicoLoading() {
  return (
    <div className="min-h-screen bg-gray-50 pb-24" aria-busy="true" aria-label="Carregando">
      <header className="sticky top-0 z-20 border-b border-white/15 bg-[#0097b2] pt-safe">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-4">
          <div className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-white/20" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-5 w-40 animate-pulse rounded bg-white/25" />
            <div className="h-3 w-56 animate-pulse rounded bg-white/15" />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-4xl space-y-4 px-4 pt-4">
        <div className="flex gap-2">
          <div className="h-11 flex-1 animate-pulse rounded-lg bg-gray-200" />
          <div className="h-11 flex-1 animate-pulse rounded-lg bg-gray-200" />
        </div>
        <div className="h-40 animate-pulse rounded-xl bg-gray-200" />
        <div className="h-28 animate-pulse rounded-xl bg-gray-200" />
      </div>
    </div>
  )
}
