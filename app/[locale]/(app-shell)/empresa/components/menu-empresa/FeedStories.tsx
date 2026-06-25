'use client'

import { useEffect, useState } from 'react'
import { Link } from '@/i18n/navigation'
import { Image as ImageIcon, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useDashboardEmpresa } from '@/app/[locale]/(app-shell)/dashboard/empresa/hooks/useDashboardEmpresa'
import { useEmpresaServicosPlano } from '@/hooks/useEmpresaServicosPlano'
import AgendarPublicacoes from './AgendarPublicacoes'
import { tentarProcessarPublicacoesAgendadas } from '@/lib/processarPublicacoesAgendadasClient'

function BotaoAcao({
  href,
  icon: Icon,
  categoria,
  titulo,
  descricao,
}: {
  href: string
  icon: typeof ImageIcon
  categoria: string
  titulo: string
  descricao: string
}) {
  return (
    <Link
      href={href}
      className="flex w-full items-center gap-4 rounded-xl border border-gray-200 bg-white px-4 py-4 shadow-sm transition hover:border-[#0097b2]/40 hover:bg-[#0097b2]/5"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#0097b2]/10 text-[#0097b2]">
        <Icon className="h-6 w-6" strokeWidth={2} aria-hidden />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-[10px] font-bold uppercase tracking-widest text-[#0097b2]">{categoria}</span>
        <span className="mt-0.5 block text-sm font-bold text-[#001f3f]">{titulo}</span>
        <span className="mt-0.5 block text-xs text-gray-600">{descricao}</span>
      </span>
    </Link>
  )
}

export default function FeedStories() {
  const [usuarioId, setUsuarioId] = useState<string | null>(null)
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const { dados } = useDashboardEmpresa()
  const { servicos, featureLiberada } = useEmpresaServicosPlano(dados?.plano, dados?.id)
  const mostrarPlanejador =
    servicos.length > 0 || featureLiberada('planejador_publicacoes')

  useEffect(() => {
    let ativo = true
    const boot = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const uid = session?.user?.id ?? null
      if (!ativo) return
      setUsuarioId(uid)
      if (!uid) {
        setEmpresaId(null)
        return
      }
      const { data: emp } = await supabase.from('empresas').select('id').eq('usuario_id', uid).maybeSingle()
      if (!ativo) return
      setEmpresaId(emp?.id != null ? String(emp.id) : null)
    }
    void boot()
    return () => {
      ativo = false
    }
  }, [])

  useEffect(() => {
    void tentarProcessarPublicacoesAgendadas()
  }, [])

  return (
    <div className="mt-4 space-y-4">
      <div className="space-y-3">
        <BotaoAcao
          href="/feed/criar"
          icon={ImageIcon}
          categoria="Feed"
          titulo="Foto com legenda ou post de texto"
          descricao="Publique no feed da sua empresa com recorte e legenda."
        />
        <BotaoAcao
          href="/feed/story/criar"
          icon={Sparkles}
          categoria="Story"
          titulo="Publicação temporária por 24h"
          descricao="Escolha uma imagem, edite e publique nos stories."
        />
      </div>

      {mostrarPlanejador ? <AgendarPublicacoes usuarioId={usuarioId} empresaId={empresaId} /> : null}
    </div>
  )
}
