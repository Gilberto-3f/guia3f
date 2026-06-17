'use client'

import { useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { enviarMensagemMensageiroAdm } from '@/lib/mensageiroAdm'

/**
 * Mensageiro de emergência / contato com a equipe ADM (canal Mensageiro ADM).
 *
 * @param {{
 *   titulo?: string
 *   subtitulo?: string
 *   incluirLocalizacao?: boolean
 *   placeholder?: string
 *   origem?: 'emergencia' | 'falar_adm'
 * }} props
 */
export default function EmergenciaMensageiroAdm({
  titulo = 'Mensageiro de Emergência',
  subtitulo = 'Descreva sua situação. Um administrador irá orientá-lo o mais rápido possível.',
  incluirLocalizacao = false,
  placeholder = 'Descreva o que está acontecendo…',
  origem = 'emergencia',
}) {
  const [mensagem, setMensagem] = useState('')
  const [localizacao, setLocalizacao] = useState(/** @type {string | null} */ (null))
  const [buscandoLoc, setBuscandoLoc] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const obterLocalizacao = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      window.alert('Geolocalização não disponível neste dispositivo.')
      return
    }
    setBuscandoLoc(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const txt = `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`
        setLocalizacao(txt)
        setBuscandoLoc(false)
      },
      () => {
        setBuscandoLoc(false)
        window.alert('Não foi possível obter a localização. Verifique as permissões do navegador.')
      },
      { enableHighAccuracy: true, timeout: 12000 }
    )
  }, [])

  const enviar = async () => {
    const texto = mensagem.trim()
    if (!texto) return
    setEnviando(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.user?.id) {
        window.alert('Inicie sessão para enviar mensagens.')
        return
      }

      const { data: usuario } = await supabase.from('usuarios').select('role, email').eq('id', session.user.id).maybeSingle()
      const role = String(usuario?.role ?? 'usuário')

      let nomeExibicao = usuario?.email ? String(usuario.email).split('@')[0] : null
      if (role === 'turista') {
        const { data: t } = await supabase.from('turistas').select('nome_completo').eq('usuario_id', session.user.id).maybeSingle()
        if (t?.nome_completo) nomeExibicao = String(t.nome_completo)
      } else if (role === 'profissional') {
        const { data: p } = await supabase
          .from('profissionais')
          .select('nome_completo')
          .eq('usuario_id', session.user.id)
          .maybeSingle()
        if (p?.nome_completo) nomeExibicao = String(p.nome_completo)
      } else if (role === 'empresa') {
        const { data: e } = await supabase.from('empresas').select('nome_fantasia').eq('usuario_id', session.user.id).maybeSingle()
        if (e?.nome_fantasia) nomeExibicao = String(e.nome_fantasia)
      }

      const corpo = incluirLocalizacao && localizacao ? `${texto}\n\n📍 Localização: ${localizacao}` : texto

      const res = await enviarMensagemMensageiroAdm(supabase, session.user.id, corpo, {
        origem,
        role,
        nomeExibicao,
      })

      if (!res.ok) {
        window.alert(res.error ?? 'Não foi possível enviar. Tente novamente.')
        return
      }

      window.alert('Mensagem enviada à equipe ADM. Responderemos o mais rápido possível.')
      setMensagem('')
      setLocalizacao(null)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="px-1 pb-4">
      <p className="text-sm text-gray-600">{subtitulo}</p>

      {incluirLocalizacao ? (
        <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50/80 p-3">
          <p className="text-xs font-medium text-amber-900">Compartilhe sua localização para orientação</p>
          {localizacao ? (
            <p className="mt-1 text-xs text-amber-800">📍 {localizacao}</p>
          ) : (
            <p className="mt-1 text-xs text-amber-700">Localização ainda não compartilhada.</p>
          )}
          <button
            type="button"
            onClick={obterLocalizacao}
            disabled={buscandoLoc}
            className="mt-2 rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-50 disabled:opacity-60"
          >
            {buscandoLoc ? 'Obtendo…' : 'Compartilhar localização'}
          </button>
        </div>
      ) : null}

      <textarea
        value={mensagem}
        onChange={(e) => setMensagem(e.target.value)}
        rows={5}
        placeholder={placeholder}
        className="mt-4 w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-[#0097b2] focus:ring-1 focus:ring-[#0097b2]"
      />

      <button
        type="button"
        onClick={() => void enviar()}
        disabled={enviando || !mensagem.trim()}
        className="mt-3 w-full rounded-xl bg-[#16a34a] py-3 text-sm font-bold uppercase tracking-wide text-white hover:bg-[#15803d] disabled:opacity-50"
      >
        {enviando ? 'Enviando…' : 'Enviar mensagem'}
      </button>
    </div>
  )
}
