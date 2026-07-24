import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { createClient } from '@supabase/supabase-js'

type Props = {
  children: ReactNode
  params: Promise<{ servicoId: string; locale?: string }>
}

async function fetchServicoMeta(servicoId: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key || !servicoId) return null

  const sb = createClient(url, key)
  const { data } = await sb
    .from('servicos_locais_itens')
    .select(
      'id, nome, descricao, fotos, foto_url, preco_usd, percentual_desconto, empresa_id, ativo, empresas ( nome_fantasia, nome_usuario )',
    )
    .eq('id', servicoId)
    .eq('ativo', true)
    .maybeSingle()

  return data
}

function siteOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return undefined
}

function capaServico(row: {
  fotos?: unknown
  foto_url?: string | null
}): string | undefined {
  if (Array.isArray(row.fotos) && row.fotos.length) {
    const u = String(row.fotos[0] ?? '').trim()
    if (u) return u
  }
  if (row.foto_url) {
    const u = String(row.foto_url).trim()
    if (u) return u
  }
  return undefined
}

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { servicoId } = await params
  const servico = await fetchServicoMeta(servicoId)
  if (!servico) return { title: 'Servico | Guia 3F' }

  const nome = String(servico.nome ?? 'Servico')
  const emp =
    servico.empresas && typeof servico.empresas === 'object' && !Array.isArray(servico.empresas)
      ? (servico.empresas as { nome_fantasia?: string | null; nome_usuario?: string | null })
      : null
  const restaurante = emp?.nome_fantasia ? String(emp.nome_fantasia) : ''
  const handle = emp?.nome_usuario
    ? `@${String(emp.nome_usuario).replace(/^@+/, '')}`
    : ''
  const description = [restaurante, handle, 'Serviços Digital · Guia 3F'].filter(Boolean).join(' · ')

  let image = capaServico(servico)
  const origin = siteOrigin()
  if (image && image.startsWith('/') && origin) image = `${origin}${image}`

  const pageUrl = origin
    ? `${origin}/servicos/item/${servicoId}?ref=recomendacao`
    : `/servicos/item/${servicoId}?ref=recomendacao`

  return {
    title: `${nome} | Guia 3F`,
    description,
    openGraph: {
      title: nome,
      description,
      url: pageUrl,
      siteName: 'Guia 3F',
      type: 'website',
      locale: 'pt_BR',
      images: image ? [{ url: image, alt: nome }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: nome,
      description,
      images: image ? [image] : [],
    },
  }
}

export default function ServicoServicosLayout({ children }: Pick<Props, 'children'>) {
  return children
}
