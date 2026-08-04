'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Briefcase, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import AvatarImage from '@/components/AvatarImage'
import UsuarioHandleVerificado from '@/components/UsuarioHandleVerificado'
import { useModalScrollLock } from '@/lib/useModalScrollLock'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import { supabase } from '@/lib/supabase'

const COR = '#0097b2'

type Props = {
  aberto: boolean
  onFechar: () => void
}

/**
 * Drawer shell ESPAÇO PROFISSIONAL (Etapa B).
 * Botões por categoria entram na próxima fase.
 */
export default function DrawerEspacoProfissionalMobilidade({ aberto, onFechar }: Props) {
  const t = useTranslations('Mobilidade')
  useModalScrollLock(aberto)
  const { fotoPerfilBarra } = useProfissionalGate()
  const [nome, setNome] = useState('')
  const [username, setUsername] = useState<string | null>(null)
  const [foto, setFoto] = useState<string | null>(null)
  const [verificado, setVerificado] = useState(false)

  useEffect(() => {
    if (!aberto) return
    let ativo = true
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const uid = session?.user?.id
      if (!uid || !ativo) return
      const { data: prof } = await supabase
        .from('profissionais')
        .select('nome_completo, nome_usuario, foto_perfil_url, foto_url, docs_verificado, status')
        .eq('usuario_id', uid)
        .maybeSingle()
      if (!ativo || !prof) return
      setNome(String(prof.nome_completo ?? t('espacoProfissionalFallbackNome')))
      setUsername(prof.nome_usuario != null ? String(prof.nome_usuario) : null)
      const f =
        prof.foto_perfil_url != null && String(prof.foto_perfil_url).trim()
          ? String(prof.foto_perfil_url)
          : prof.foto_url != null && String(prof.foto_url).trim()
            ? String(prof.foto_url)
            : null
      setFoto(f ?? fotoPerfilBarra)
      setVerificado(
        Boolean(prof.docs_verificado) ||
          String(prof.status ?? '').toLowerCase() === 'aprovado',
      )
    })()
    return () => {
      ativo = false
    }
  }, [aberto, fotoPerfilBarra, t])

  if (!aberto) return null

  const handle = String(username ?? '')
    .replace(/^@+/, '')
    .trim()

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex flex-col bg-white"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-espaco-profissional-titulo"
    >
      <div className="shrink-0 pt-safe" style={{ backgroundColor: COR }}>
        <div className="flex h-12 items-center gap-2 px-3">
          <Briefcase className="h-5 w-5 shrink-0 text-white" aria-hidden />
          <h2
            id="drawer-espaco-profissional-titulo"
            className="min-w-0 flex-1 truncate text-base font-bold uppercase tracking-wide text-white"
          >
            {t('espacoProfissionalTitulo')}
          </h2>
          <button
            type="button"
            onClick={onFechar}
            className="rounded-lg p-2 text-white/90 hover:bg-white/15"
            aria-label={t('fechar')}
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6" data-modal-scroll-lock-scrollable>
        <div className="flex flex-col items-center gap-2 text-center">
          <div
            className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100"
            style={{ boxShadow: `0 0 0 4px ${COR}` }}
          >
            {foto ? (
              <AvatarImage src={foto} alt="" fill className="object-cover" sizes="80px" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-2xl font-bold text-[#0097b2]">
                {(nome || 'P').charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <p className="text-base font-bold text-gray-900">{nome || '…'}</p>
          {handle ? (
            <UsuarioHandleVerificado
              username={handle}
              verificado={verificado}
              verificadoTipo="profissional"
              asButton={false}
              className="justify-center text-sm font-normal text-gray-600"
            />
          ) : null}
        </div>

        <p className="mt-8 text-center text-sm text-gray-500">{t('espacoProfissionalBotoesEmBreve')}</p>
      </div>
    </div>,
    document.body,
  )
}
