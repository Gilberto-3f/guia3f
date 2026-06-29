'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { supabase } from '@/lib/supabase'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'
import PopupReservaConfirmadaTurista from '@/components/PopupReservaConfirmadaTurista'
import {
  buscarPopupReservaConfirmadaPendente,
  marcarPopupReservaConfirmadaExibido,
} from '@/lib/turistaCompras'

function formatarDataBr(iso) {
  if (!iso) return ''
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('pt-BR')
}

/** Realtime + popup verde quando anfitrião confirma reserva de hospedagem. */
export default function TuristaComprasNotificacaoGate() {
  const router = useRouter()
  const { modoAtivo } = useModoApresentacao()
  const [usuarioId, setUsuarioId] = useState(null)
  const [aberto, setAberto] = useState(false)
  const [dadosPopup, setDadosPopup] = useState(null)

  useEffect(() => {
    let ativo = true
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!ativo) return
      setUsuarioId(session?.user?.id ?? null)
    })()
    return () => {
      ativo = false
    }
  }, [])

  const abrirSePendente = useCallback(async () => {
    if (!usuarioId || modoAtivo || aberto) return
    const pendente = await buscarPopupReservaConfirmadaPendente(supabase, usuarioId)
    if (!pendente) return
    setDadosPopup({
      compraId: pendente.compraId,
      empresaId: pendente.empresaId,
      empresaNome: pendente.empresaNome,
      dataCheckin: formatarDataBr(pendente.dataCheckin),
      dataCheckout: formatarDataBr(pendente.dataCheckout),
    })
    setAberto(true)
    window.dispatchEvent(new CustomEvent('turista-compras-atualizado'))
  }, [usuarioId, modoAtivo, aberto])

  useEffect(() => {
    if (!usuarioId || modoAtivo) return
    void abrirSePendente()
  }, [usuarioId, modoAtivo, abrirSePendente])

  useEffect(() => {
    if (!usuarioId) return

    const ch = supabase
      .channel(`turista-compras-popup-${usuarioId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'turista_compras',
          filter: `turista_usuario_id=eq.${usuarioId}`,
        },
        () => {
          void abrirSePendente()
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'reservas_hospedagem',
          filter: `turista_usuario_id=eq.${usuarioId}`,
        },
        () => {
          void abrirSePendente()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(ch)
    }
  }, [usuarioId, abrirSePendente])

  const fechar = useCallback(async () => {
    if (dadosPopup?.compraId) {
      await marcarPopupReservaConfirmadaExibido(supabase, dadosPopup.compraId)
    }
    setAberto(false)
    setDadosPopup(null)
    window.dispatchEvent(new CustomEvent('turista-compras-atualizado'))
  }, [dadosPopup])

  const verEmpresa = useCallback(() => {
    if (!dadosPopup?.empresaId) return
    router.push(`/empresa/${dadosPopup.empresaId}`)
  }, [dadosPopup, router])

  if (!usuarioId || modoAtivo) return null

  return (
    <PopupReservaConfirmadaTurista
      isOpen={aberto}
      onClose={() => {
        void fechar()
      }}
      empresaNome={dadosPopup?.empresaNome ?? ''}
      dataCheckin={dadosPopup?.dataCheckin ?? ''}
      dataCheckout={dadosPopup?.dataCheckout ?? ''}
      onVerEmpresa={() => {
        verEmpresa()
        void fechar()
      }}
    />
  )
}
