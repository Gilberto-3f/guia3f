export type DocPagina = { label: string; url: string }
export type DocBotao = { key: string; label: string; paginas: DocPagina[] }

export function collectBotoesDocumentos(
  tipo: 'turistas' | 'profissionais' | 'empresas',
  raw: Record<string, unknown>,
): DocBotao[] {
  const push = (out: DocBotao[], key: string, label: string, paginas: DocPagina[]) => {
    const validas = paginas.filter((p) => p.url.trim())
    if (validas.length) out.push({ key, label, paginas: validas })
  }

  if (tipo === 'turistas') {
    const out: DocBotao[] = []
    const frente = String(raw.documento_frente_url ?? '').trim()
    const verso = String(raw.documento_verso_url ?? '').trim()
    push(out, 'identidade', 'Identidade', [
      ...(frente ? [{ label: 'Frente', url: frente }] : []),
      ...(verso ? [{ label: 'Verso', url: verso }] : []),
    ])
    return out
  }

  if (tipo === 'profissionais') {
    const d = (raw.documentos ?? {}) as Record<string, string>
    const idF = String(raw.documento_frente_url ?? d.identidade_url ?? raw.identidade_url ?? '').trim()
    const idV = String(d.documento_verso_url ?? raw.documento_verso_url ?? '').trim()
    const res = String(d.comprovante_residencia_url ?? raw.comprovante_residencia_url ?? '').trim()
    const prof = String(d.comprovante_profissao_url ?? raw.comprovante_profissao_url ?? '').trim()
    const out: DocBotao[] = []
    push(out, 'identidade', 'Identidade', [
      ...(idF ? [{ label: 'Frente', url: idF }] : []),
      ...(idV ? [{ label: 'Verso', url: idV }] : []),
    ])
    push(out, 'endereco', 'Endereço', res ? [{ label: 'Comprovante', url: res }] : [])
    push(out, 'profissao', 'Profissão', prof ? [{ label: 'Comprovante', url: prof }] : [])
    return out
  }

  const ef = String(raw.documento_frente_url ?? '').trim()
  const ev = String(raw.documento_verso_url ?? '').trim()
  const er = String(raw.comprovante_residencia_url ?? '').trim()
  const ec = String(raw.documento_comercial_url ?? raw.documento_url ?? '').trim()
  const out: DocBotao[] = []
  push(out, 'identidade', 'Identidade', [
    ...(ef ? [{ label: 'Representante — frente', url: ef }] : []),
    ...(ev ? [{ label: 'Representante — verso', url: ev }] : []),
  ])
  push(out, 'endereco', 'Endereço', er ? [{ label: 'Comprovante', url: er }] : [])
  push(out, 'comercial', 'Comercial', ec ? [{ label: 'Documento', url: ec }] : [])
  return out
}

export function urlsDeBotoes(botoes: DocBotao[]): string[] {
  return botoes.flatMap((b) => b.paginas.map((p) => p.url)).filter((u) => u.trim())
}
