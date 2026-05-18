'use client'

import { yawGrausParaPosicaoPercent } from '@/lib/pannellumTour'

/**
 * Faixa central da foto 360° + pino fixo + régua (sem Pannellum).
 *
 * @param {{
 *   panoramaUrl: string
 *   yawGraus: number
 *   onYawChange: (yaw: number) => void
 *   numeroDestino: number | null
 *   destinoConectado?: boolean
 * }} props
 */
export default function EditorTourViewport({
  panoramaUrl,
  yawGraus,
  onYawChange,
  numeroDestino,
  destinoConectado = false,
}) {
  const bgPosX = yawGrausParaPosicaoPercent(yawGraus)

  return (
    <div className="w-full">
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg bg-black">
        <div
          className="absolute inset-0 transition-[background-position] duration-150 ease-out"
          style={{
            backgroundImage: `url(${panoramaUrl})`,
            backgroundSize: 'auto 320%',
            backgroundPosition: `${bgPosX}% 50%`,
            backgroundRepeat: 'no-repeat',
            clipPath: 'inset(26% 0 26% 0)',
          }}
          role="img"
          aria-label="Referência visual 360 graus"
        />
        <div
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
          aria-hidden
        >
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold text-white shadow-lg ring-2 ring-white/80 ${
              destinoConectado ? 'bg-[#00D443]' : 'bg-[#0097b2]'
            }`}
          >
            {numeroDestino != null ? numeroDestino : '?'}
          </div>
        </div>

        <div className="absolute bottom-2 left-3 right-3 z-20 flex items-center gap-2">
          <span className="shrink-0 text-xs font-bold text-white drop-shadow" aria-hidden>
            ◄
          </span>
          <input
            type="range"
            min={0}
            max={360}
            step={0.5}
            value={yawGraus}
            onChange={(e) => onYawChange(Number(e.target.value))}
            className="h-2 min-w-0 flex-1 cursor-ew-resize appearance-none rounded-full bg-white/25 accent-[#0097b2]"
            aria-label="Régua: rodar a imagem para posicionar o ponto"
          />
          <span className="w-12 shrink-0 text-right text-xs font-semibold tabular-nums text-white drop-shadow">
            {Math.round(yawGraus)}°
          </span>
          <span className="shrink-0 text-xs font-bold text-white drop-shadow" aria-hidden>
            ►
          </span>
        </div>
      </div>
    </div>
  )
}
