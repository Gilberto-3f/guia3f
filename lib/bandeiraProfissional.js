const BANDEIRA_POR_CIDADE = {
  'Foz do Iguacu': '🇧🇷',
  'Foz do Iguaçu': '🇧🇷',
  'Ciudad del Este': '🇵🇾',
  'Puerto Iguazu': '🇦🇷',
  'Puerto Iguazú': '🇦🇷',
}

/**
 * Bandeira do país de registro do profissional (Brasil, Paraguai ou Argentina).
 * @param {{ pais?: string | null, cidadeAtuacao?: string | string[] | null }} params
 * @returns {string | null}
 */
export function bandeiraProfissionalRegistro({ pais, cidadeAtuacao }) {
  const p = String(pais ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (p.includes('brasil') || p === 'br') return '🇧🇷'
  if (p.includes('paraguai') || p.includes('paraguay') || p === 'py') return '🇵🇾'
  if (p.includes('argentina') || p === 'ar') return '🇦🇷'

  const cidades = Array.isArray(cidadeAtuacao)
    ? cidadeAtuacao
    : cidadeAtuacao
      ? [cidadeAtuacao]
      : []

  for (const c of cidades) {
    const chave = String(c ?? '').trim()
    if (BANDEIRA_POR_CIDADE[chave]) return BANDEIRA_POR_CIDADE[chave]
  }

  return null
}
