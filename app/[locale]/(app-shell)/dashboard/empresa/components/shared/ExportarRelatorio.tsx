'use client'

import { useCallback, useState } from 'react'
import { FileSpreadsheet, FileText, Sheet } from 'lucide-react'
import {
  estruturarSecoesExportacao,
  exportarRelatorioCsv,
  exportarRelatorioExcel,
  exportarRelatorioPdf,
  nomeArquivoExportacao,
  tituloPlanilha,
  tituloRelatorio,
} from '@/lib/exportarRelatorioDashboard'

interface Props {
  dados: Record<string, unknown>
  tipo: 'funil' | 'mercado' | 'drena'
  /** Carrega dados adicionais antes de exportar (ex.: detalhes do funil). */
  preparar?: () => Promise<Record<string, unknown>>
}

export default function ExportarRelatorio({ dados, tipo, preparar }: Props) {
  const [exportando, setExportando] = useState<'pdf' | 'csv' | 'excel' | null>(null)

  const obterDadosCompletos = useCallback(async () => {
    const extra = preparar ? await preparar() : {}
    return { ...dados, ...extra }
  }, [dados, preparar])

  const exportar = useCallback(
    async (formato: 'pdf' | 'csv' | 'excel') => {
      setExportando(formato)
      try {
        const payload = await obterDadosCompletos()
        const secoes = estruturarSecoesExportacao(payload)
        if (secoes.length === 0) {
          secoes.push({
            titulo: 'Relatorio',
            colunas: ['info'],
            linhas: [['Nenhum dado disponivel para exportacao']],
          })
        }

        const titulo = tituloRelatorio(tipo)
        if (formato === 'csv') {
          exportarRelatorioCsv(secoes, nomeArquivoExportacao(tipo, 'csv'))
        } else if (formato === 'excel') {
          exportarRelatorioExcel(secoes, nomeArquivoExportacao(tipo, 'xls'), tituloPlanilha(tipo))
        } else {
          exportarRelatorioPdf(secoes, nomeArquivoExportacao(tipo, 'pdf'), titulo)
        }
      } finally {
        setExportando(null)
      }
    },
    [obterDadosCompletos, tipo],
  )

  const btnCls =
    'inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50'

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => void exportar('pdf')}
        disabled={exportando !== null}
        className={btnCls}
      >
        <FileText className="h-4 w-4" aria-hidden />
        {exportando === 'pdf' ? 'Gerando…' : 'PDF'}
      </button>
      <button
        type="button"
        onClick={() => void exportar('csv')}
        disabled={exportando !== null}
        className={btnCls}
      >
        <Sheet className="h-4 w-4" aria-hidden />
        {exportando === 'csv' ? 'Gerando…' : 'CSV'}
      </button>
      <button
        type="button"
        onClick={() => void exportar('excel')}
        disabled={exportando !== null}
        className={btnCls}
      >
        <FileSpreadsheet className="h-4 w-4" aria-hidden />
        {exportando === 'excel' ? 'Gerando…' : 'EXCEL'}
      </button>
    </div>
  )
}
