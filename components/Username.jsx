'use client'

/**
 * @param {{ username: string }} props
 */
export default function Username({ username }) {
  const raw = String(username ?? '').trim().replace(/^@+/, '')
  const shown = raw.length > 15 ? `${raw.slice(0, 15)}…` : raw
  const size = raw.length > 10 ? 'text-[16px]' : 'text-[17px]'
  return (
    <span className={`block max-w-[min(50vw,320px)] truncate font-normal text-gray-600 ${size}`}>
      @{shown || 'usuario'}
    </span>
  )
}
