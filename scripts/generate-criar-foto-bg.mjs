/**
 * Gera `public/feed/criar-foto-bg.webp` (fundo pastel + bokeh) a partir de SVG rasterizado.
 * Executar: node scripts/generate-criar-foto-bg.mjs
 */
import { mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const outDir = join(root, 'public', 'feed')
const outFile = join(outDir, 'criar-foto-bg.webp')

const W = 1080
const H = 1920

/** Círculos suaves (bokeh) — posições fixas para resultado reprodutível */
const circles = [
  [540, 120, 420, 'rgba(255,255,255,0.55)'],
  [180, 280, 160, 'rgba(186,230,253,0.45)'],
  [920, 220, 140, 'rgba(255,255,255,0.4)'],
  [320, 520, 200, 'rgba(255,220,235,0.38)'],
  [780, 480, 190, 'rgba(200,230,255,0.36)'],
  [520, 640, 280, 'rgba(255,255,255,0.22)'],
  [120, 820, 150, 'rgba(237,200,230,0.4)'],
  [960, 900, 170, 'rgba(220,210,255,0.35)'],
  [440, 360, 90, 'rgba(255,255,255,0.5)'],
  [680, 320, 70, 'rgba(255,255,255,0.55)'],
  [260, 680, 110, 'rgba(255,245,250,0.35)'],
  [820, 620, 100, 'rgba(230,240,255,0.38)'],
  [540, 1100, 240, 'rgba(245,210,225,0.42)'],
  [500, 420, 55, 'rgba(255,255,255,0.6)'],
  [200, 520, 48, 'rgba(255,255,255,0.35)'],
  [880, 480, 58, 'rgba(200,220,255,0.32)'],
  [640, 780, 36, 'rgba(255,255,255,0.5)'],
  [300, 980, 42, 'rgba(255,255,255,0.4)'],
  [900, 180, 50, 'rgba(255,255,255,0.45)'],
  [720, 380, 28, 'rgba(255,255,255,0.55)'],
  [400, 900, 65, 'rgba(255,255,255,0.25)'],
  [160, 1200, 120, 'rgba(255,255,255,0.2)'],
  [920, 1300, 100, 'rgba(230,220,255,0.28)'],
  [540, 1500, 300, 'rgba(255,230,240,0.25)'],
  [340, 1400, 80, 'rgba(255,255,255,0.3)'],
  [760, 1550, 95, 'rgba(200,230,255,0.22)'],
]

const circlesSvg = circles
  .map(
    ([cx, cy, r, fill]) =>
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" />`,
  )
  .join('\n')

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="base" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#fdfaff"/>
      <stop offset="42%" stop-color="#c8e6ff"/>
      <stop offset="72%" stop-color="#e8e0f8"/>
      <stop offset="100%" stop-color="#f5e1ed"/>
    </linearGradient>
    <radialGradient id="bloom" cx="50%" cy="32%" r="58%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.92"/>
      <stop offset="45%" stop-color="#ffffff" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#base)"/>
  <rect width="100%" height="100%" fill="url(#bloom)"/>
  ${circlesSvg}
</svg>`

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

await sharp(Buffer.from(svg))
  .webp({ quality: 80, effort: 6, smartSubsample: true })
  .toFile(outFile)

console.log('Escrito:', outFile)
