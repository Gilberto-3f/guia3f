'use client'

import { useMemo, useState } from 'react'

interface Props {
  dados: Record<string, unknown>
  tipo: 'funil' | 'mercado' | 'drena'
}

function toCsvValue(v: unknown) {
  if (v == null) return ''
  const s = String(v)
  if (s.includes('"') || s.includes(',') || s.includes('\n')) return `"${s.replaceAll('"', '""')}"`
  return s
}

export default function ExportarRelatorio({ dados, tipo }: Props) {
  const [exportando, setExportando] = useState(false)

  const filename = useMemo(() => `${tipo}_${new Date().toISOString().slice(0, 10)}.csv`, [tipo])

  const exportarCSV = () => {
    const entries = Object.entries(dados ?? {})
    const headers = entries.map(([k]) => toCsvValue(k)).join(',')
    const values = entries.map(([, v]) => toCsvValue(v)).join(',')
    const csv = `${headers}\n${values}\n`

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const exportarPlaceholder = async () => {
    setExportando(true)
    await new Promise((r) => setTimeout(r, 350))
    setExportando(false)
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => void exportarPlaceholder()}
        disabled={exportando}
        className="rounded-lg bg-gray-200 px-3 py-1.5 text-sm hover:bg-gray-300 disabled:opacity-50"
        title="Em desenvolvimento"
      >
        📄 PDF
      </button>
      <button
        type="button"
        onClick={exportarCSV}
        className="rounded-lg bg-gray-200 px-3 py-1.5 text-sm hover:bg-gray-300"
      >
        📊 CSV
      </button>
      <button
        type="button"
        onClick={() => void exportarPlaceholder()}
        disabled={exportando}
        className="rounded-lg bg-gray-200 px-3 py-1.5 text-sm hover:bg-gray-300 disabled:opacity-50"
        title="Em desenvolvimento"
      >
        📈 EXCEL
      </button>
    </div>
  )
}

