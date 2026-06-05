'use client'

import { useMemo, useState } from 'react'
import { FileSpreadsheet, FileText, Sheet } from 'lucide-react'

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

  const btnCls =
    'inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50'

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => void exportarPlaceholder()}
        disabled={exportando}
        className={btnCls}
        title="Em desenvolvimento"
      >
        <FileText className="h-4 w-4" aria-hidden />
        PDF
      </button>
      <button
        type="button"
        onClick={exportarCSV}
        className={btnCls}
      >
        <Sheet className="h-4 w-4" aria-hidden />
        CSV
      </button>
      <button
        type="button"
        onClick={() => void exportarPlaceholder()}
        disabled={exportando}
        className={btnCls}
        title="Em desenvolvimento"
      >
        <FileSpreadsheet className="h-4 w-4" aria-hidden />
        EXCEL
      </button>
    </div>
  )
}
