import { normalizarCidadeTriplice, type CidadeTriplice } from '@/lib/mobilidadeRegional'

const ROTULO_LOCALIZACAO_TRIPLICE: Record<CidadeTriplice, string> = {
  'Foz do Iguaçu': 'FOZ - Brasil',
  'Ciudad del Este': 'CDE - Paraguai',
  'Puerto Iguazu': 'P. Iguazú - Argentina',
}

function rotuloPaisPorTexto(pais: string): string | null {
  const p = pais
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (!p) return null
  if (p.includes('brasil') || p === 'br') return 'Brasil'
  if (p.includes('paraguai') || p.includes('paraguay') || p === 'py') return 'Paraguai'
  if (p.includes('argentina') || p === 'ar') return 'Argentina'
  return null
}

/** Ex.: FOZ - Brasil, CDE - Paraguai, P. Iguazú - Argentina (card de verificação ADM). */
export function formatLocalizacaoVerificacao(params: {
  cidade?: string | null
  cidadesAtuacao?: unknown
  pais?: string | null
}): string | null {
  const candidatos: string[] = []
  const c = String(params.cidade ?? '').trim()
  if (c) candidatos.push(c)
  const raw = params.cidadesAtuacao
  if (Array.isArray(raw)) candidatos.push(...raw.map((v) => String(v)))
  else if (raw != null && String(raw).trim()) candidatos.push(String(raw))

  for (const item of candidatos) {
    const norm = normalizarCidadeTriplice(item)
    if (norm) return ROTULO_LOCALIZACAO_TRIPLICE[norm]
  }

  const pais = rotuloPaisPorTexto(String(params.pais ?? ''))
  if (pais && candidatos[0]) {
    const abrev = candidatos[0].slice(0, 3).toUpperCase()
    return `${abrev} - ${pais}`
  }
  if (pais) return pais
  return null
}

const CATEGORIA_LABEL: Record<string, string> = {
  guias: 'Guia de Turismo',
  guia: 'Guia de Turismo',
  'guia de turismo': 'Guia de Turismo',
  taxistas: 'Taxista',
  taxista: 'Taxista',
  motorista_app: 'Motorista de App',
  'motorista de app': 'Motorista de App',
  vans: 'Motorista de Van',
  van: 'Motorista de Van',
  'motorista de van': 'Motorista de Van',
  anfitriao: 'Anfitrião',
  anfitrião: 'Anfitrião',
  anfitrioes: 'Anfitrião',
}

/** Exibe categorias do profissional com rótulos amigáveis. Aceita ausência / formato inesperado (ex.: estado antigo na UI). */
export function formatProfissionalCategorias(cats: unknown): string {
  const list: string[] = Array.isArray(cats) ? cats.map((v) => String(v)) : []
  if (!list.length) return '—'
  return list
    .map((c) => {
      const k = c.trim().toLowerCase()
      return CATEGORIA_LABEL[k] ?? c.trim()
    })
    .join(', ')
}

/** Formata dígitos como contato BR quando possível; caso contrário devolve o texto original. */
export function formatContatoExibicao(val: unknown): string {
  const s = String(val ?? '').trim()
  if (!s) return '—'
  const d = s.replace(/\D/g, '')
  if (d.length >= 10 && d.length <= 13) {
    const rest = d.length > 11 ? d.slice(-11) : d
    const cc = d.length > 11 ? d.slice(0, d.length - 11) : '55'
    if (rest.length === 11) {
      const a = rest.slice(0, 2)
      const b = rest.slice(2, 7)
      const c = rest.slice(7)
      return cc === '55' ? `+55 (${a}) ${b}-${c}` : `+${cc} (${a}) ${b}-${c}`
    }
    if (rest.length === 10) {
      const a = rest.slice(0, 2)
      const b = rest.slice(2, 6)
      const c = rest.slice(6)
      return `+55 (${a}) ${b}-${c}`
    }
  }
  return s
}

export function pickDocumentoEmpresaUrl(r: Record<string, unknown>): string {
  const u = r.documento_comercial_url ?? r.documento_url ?? r.documento_comercial
  return u ? String(u) : ''
}

export function pickDocumentoFiscalEmpresa(r: Record<string, unknown>): string {
  const v = r.cnpj ?? r.cnpj_cpf ?? r.documento_fiscal ?? r.inscricao_estadual ?? r.ruc ?? r.cuit
  const s = v != null ? String(v).trim() : ''
  return s || '—'
}
