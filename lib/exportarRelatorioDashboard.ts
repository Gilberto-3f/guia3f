export interface SecaoExportacao {
  titulo: string
  colunas: string[]
  linhas: string[][]
}

function escaparCsv(valor: unknown): string {
  if (valor == null) return ''
  const s = String(valor)
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes(';')) {
    return `"${s.replaceAll('"', '""')}"`
  }
  return s
}

function escaparXml(valor: string): string {
  return valor
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function escaparPdfTexto(texto: string): string {
  return texto.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function normalizarChave(chave: string): string {
  return chave.replace(/_/g, ' ')
}

function linhaDeObjeto(obj: Record<string, unknown>): string[] {
  return Object.values(obj).map((v) => {
    if (v == null) return ''
    if (typeof v === 'object') return JSON.stringify(v)
    return String(v)
  })
}

function colunasDeObjeto(obj: Record<string, unknown>): string[] {
  return Object.keys(obj).map(normalizarChave)
}

function ehArrayObjetos(valor: unknown): valor is Record<string, unknown>[] {
  return Array.isArray(valor) && valor.length > 0 && typeof valor[0] === 'object' && valor[0] !== null
}

function ehObjetoPlano(valor: unknown): valor is Record<string, unknown> {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return false
  return Object.values(valor).every((v) => v == null || typeof v !== 'object')
}

/** Converte payload aninhado em seções tabulares para exportação. */
export function estruturarSecoesExportacao(dados: Record<string, unknown>): SecaoExportacao[] {
  const secoes: SecaoExportacao[] = []
  const resumo: Record<string, unknown> = {}

  for (const [chave, valor] of Object.entries(dados ?? {})) {
    if (valor == null) continue

    if (Array.isArray(valor)) {
      if (ehArrayObjetos(valor)) {
        const colunas = colunasDeObjeto(valor[0])
        secoes.push({
          titulo: normalizarChave(chave),
          colunas,
          linhas: valor.map((row) => linhaDeObjeto(row)),
        })
      } else if (valor.length > 0) {
        resumo[normalizarChave(chave)] = valor.join('; ')
      }
      continue
    }

    if (ehObjetoPlano(valor)) {
      secoes.push({
        titulo: normalizarChave(chave),
        colunas: colunasDeObjeto(valor),
        linhas: [linhaDeObjeto(valor)],
      })
      continue
    }

    if (typeof valor === 'object' && !Array.isArray(valor)) {
      const nested = estruturarSecoesExportacao(valor as Record<string, unknown>)
      for (const sec of nested) {
        secoes.push({ ...sec, titulo: `${normalizarChave(chave)} — ${sec.titulo}` })
      }
      continue
    }

    resumo[normalizarChave(chave)] = valor
  }

  if (Object.keys(resumo).length > 0) {
    secoes.unshift({
      titulo: 'Resumo',
      colunas: Object.keys(resumo),
      linhas: [Object.values(resumo).map((v) => (v == null ? '' : String(v)))],
    })
  }

  return secoes
}

export function gerarConteudoCsv(secoes: SecaoExportacao[]): string {
  const partes: string[] = []

  for (const sec of secoes) {
    partes.push(`# ${sec.titulo}`)
    partes.push(sec.colunas.map(escaparCsv).join(','))
    for (const linha of sec.linhas) {
      partes.push(linha.map(escaparCsv).join(','))
    }
    partes.push('')
  }

  return `\uFEFF${partes.join('\n')}`
}

export function gerarConteudoExcelXml(secoes: SecaoExportacao[], tituloPlanilha: string): string {
  const linhasXml: string[] = []

  for (const sec of secoes) {
    linhasXml.push('<Row><Cell ss:StyleID="titulo"><Data ss:Type="String">' + escaparXml(sec.titulo) + '</Data></Cell></Row>')
    linhasXml.push(
      '<Row>' +
        sec.colunas.map((c) => `<Cell ss:StyleID="cabecalho"><Data ss:Type="String">${escaparXml(c)}</Data></Cell>`).join('') +
        '</Row>',
    )
    for (const linha of sec.linhas) {
      linhasXml.push(
        '<Row>' +
          linha
            .map((c) => `<Cell><Data ss:Type="String">${escaparXml(c)}</Data></Cell>`)
            .join('') +
          '</Row>',
      )
    }
    linhasXml.push('<Row></Row>')
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles>
  <Style ss:ID="titulo"><Font ss:Bold="1" ss:Size="12"/></Style>
  <Style ss:ID="cabecalho"><Font ss:Bold="1"/></Style>
</Styles>
<Worksheet ss:Name="${escaparXml(tituloPlanilha.slice(0, 31))}">
<Table>${linhasXml.join('')}</Table>
</Worksheet>
</Workbook>`
}

function linhasPdfDeSecoes(secoes: SecaoExportacao[]): string[] {
  const linhas: string[] = []
  for (const sec of secoes) {
    linhas.push(sec.titulo.toUpperCase())
    linhas.push(sec.colunas.join(' | '))
    for (const row of sec.linhas) {
      linhas.push(row.join(' | '))
    }
    linhas.push('')
  }
  return linhas
}

/** PDF textual simples (multi-página) compatível com leitores desktop e mobile. */
export function gerarBlobPdf(titulo: string, secoes: SecaoExportacao[]): Blob {
  const linhas = [titulo, `Exportado em: ${new Date().toLocaleString('pt-BR')}`, '', ...linhasPdfDeSecoes(secoes)]
  const fontSize = 10
  const lineHeight = 14
  const margin = 50
  const pageHeight = 792
  const maxLines = Math.floor((pageHeight - margin * 2) / lineHeight)

  const paginas: string[][] = []
  for (let i = 0; i < linhas.length; i += maxLines) {
    paginas.push(linhas.slice(i, i + maxLines))
  }
  if (paginas.length === 0) paginas.push([''])

  const objetos: string[] = []
  const offsets: number[] = []
  let objId = 1

  const catalogId = objId++
  const pagesId = objId++
  const fontId = objId++
  const pageIds: number[] = []
  const contentIds: number[] = []

  for (const pagina of paginas) {
    pageIds.push(objId++)
    contentIds.push(objId++)
  }

  objetos.push(`${catalogId} 0 obj<< /Type /Catalog /Pages ${pagesId} 0 R >>endobj`)
  objetos.push(
    `${pagesId} 0 obj<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>endobj`,
  )
  objetos.push(`${fontId} 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj`)

  for (let p = 0; p < paginas.length; p++) {
    const pageId = pageIds[p]
    const contentId = contentIds[p]
    let y = pageHeight - margin
    const cmds: string[] = ['BT', `/F1 ${fontSize} Tf`]
    for (const linha of paginas[p]) {
      const truncada = linha.length > 95 ? `${linha.slice(0, 92)}...` : linha
      cmds.push(`${margin} ${y} Td (${escaparPdfTexto(truncada)}) Tj`)
      y -= lineHeight
    }
    cmds.push('ET')
    const stream = cmds.join('\n')
    objetos.push(
      `${pageId} 0 obj<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 ${pageHeight}] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>endobj`,
    )
    objetos.push(`${contentId} 0 obj<< /Length ${stream.length} >>stream\n${stream}\nendstream endobj`)
  }

  let pdf = '%PDF-1.4\n'
  for (const obj of objetos) {
    offsets.push(pdf.length)
    pdf += `${obj}\n`
  }

  const xrefPos = pdf.length
  pdf += `xref\n0 ${objetos.length + 1}\n`
  pdf += '0000000000 65535 f \n'
  for (const off of offsets) {
    pdf += `${String(off).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer<< /Size ${objetos.length + 1} /Root ${catalogId} 0 R >>\n`
  pdf += `startxref\n${xrefPos}\n%%EOF`

  return new Blob([pdf], { type: 'application/pdf' })
}

export function baixarArquivo(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  window.setTimeout(() => {
    a.remove()
    URL.revokeObjectURL(url)
  }, 200)
}

export function exportarRelatorioCsv(secoes: SecaoExportacao[], filename: string) {
  baixarArquivo(new Blob([gerarConteudoCsv(secoes)], { type: 'text/csv;charset=utf-8' }), filename)
}

export function exportarRelatorioExcel(secoes: SecaoExportacao[], filename: string, tituloPlanilha: string) {
  baixarArquivo(
    new Blob([gerarConteudoExcelXml(secoes, tituloPlanilha)], {
      type: 'application/vnd.ms-excel;charset=utf-8',
    }),
    filename,
  )
}

export function exportarRelatorioPdf(secoes: SecaoExportacao[], filename: string, titulo: string) {
  baixarArquivo(gerarBlobPdf(titulo, secoes), filename)
}

export function nomeArquivoExportacao(tipo: string, extensao: string) {
  const data = new Date().toISOString().slice(0, 10)
  return `${tipo}_${data}.${extensao}`
}

export function tituloRelatorio(tipo: 'funil' | 'mercado' | 'drena') {
  if (tipo === 'funil') return 'Funil de Conversao — 3F Guia'
  if (tipo === 'mercado') return 'Estatisticas de Mercado — 3F Guia'
  return 'Relatorio Drena Stok — 3F Guia'
}

export function tituloPlanilha(tipo: 'funil' | 'mercado' | 'drena') {
  if (tipo === 'funil') return 'Funil'
  if (tipo === 'mercado') return 'Mercado'
  return 'Drena'
}
