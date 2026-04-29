'use client'

import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { usePermissao } from '../../hooks/usePermissao'
import { pickDocumentoEmpresaUrl } from './verificacaoFormatters'

export function VisualizadorDocs({
  aberto,
  onClose,
  pendente,
  tipo,
  onMarcarVerificado,
}: {
  aberto: boolean
  onClose: () => void
  pendente: Record<string, unknown>
  tipo: 'turistas' | 'profissionais' | 'empresas'
  onMarcarVerificado: () => void
}) {
  const [zoom, setZoom] = useState(1)
  const [motivoSolicitacao, setMotivoSolicitacao] = useState('')
  const [solicitando, setSolicitando] = useState(false)
  const { admin, nivel } = usePermissao()

  const docs = useMemo(() => {
    if (tipo === 'turistas') {
      return [
        { label: 'Documento frente', url: String(pendente.documento_frente_url ?? '') },
        { label: 'Documento verso', url: String(pendente.documento_verso_url ?? '') },
      ].filter((d) => d.url)
    }
    if (tipo === 'profissionais') {
      const d = (pendente.documentos ?? {}) as Record<string, string>
      const idF = String(d.identidade_url ?? pendente.identidade_url ?? '')
      const idV = String(d.documento_verso_url ?? pendente.documento_verso_url ?? '')
      const res = String(d.comprovante_residencia_url ?? pendente.comprovante_residencia_url ?? '')
      const prof = String(d.comprovante_profissao_url ?? pendente.comprovante_profissao_url ?? '')
      return [
        { label: 'Identidade (frente)', url: idF },
        { label: 'Identidade (verso)', url: idV },
        { label: 'Comprovante residência', url: res },
        { label: 'Comprovante profissão', url: prof },
      ].filter((x) => x.url)
    }
    const comercial = pickDocumentoEmpresaUrl(pendente)
    return [{ label: 'Documento comercial', url: comercial }].filter((x) => x.url)
  }, [pendente, tipo])

  const isAdminGeral = nivel === 1
  const isVerificador = String(pendente.docs_verificado_por ?? '') === String(admin?.id ?? '')
  const podeVerDocs = isAdminGeral || isVerificador

  const handleSolicitarAcesso = async () => {
    if (!admin) return
    setSolicitando(true)
    try {
      const { error } = await supabase.rpc('solicitar_acesso_documentos', {
        p_solicitante_id: admin.id,
        p_perfil_tipo: tipo === 'turistas' ? 'turista' : tipo === 'profissionais' ? 'profissional' : 'empresa',
        p_perfil_id: String(pendente.id ?? ''),
        p_motivo: motivoSolicitacao,
      })
      if (error) throw error
      onClose()
    } finally {
      setSolicitando(false)
    }
  }

  if (!aberto) return null

  if (!podeVerDocs) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
        <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
          <h3 className="text-base font-bold text-gray-900">Acesso restrito</h3>
          <p className="mt-2 text-sm text-gray-600">
            Este documento foi verificado por outro moderador. Voce pode solicitar acesso ao ADM GERAL.
          </p>
          <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
            <div>Perfil: {String(pendente.nome_usuario ?? '-')}</div>
            <div>Verificado por: {String(pendente.docs_verificado_por ?? '-')}</div>
            <div>Data: {pendente.docs_verificado_em ? new Date(String(pendente.docs_verificado_em)).toLocaleDateString('pt-BR') : '-'}</div>
          </div>
          <textarea
            value={motivoSolicitacao}
            onChange={(e) => setMotivoSolicitacao(e.target.value)}
            placeholder="Informe o motivo da solicitacao..."
            className="mt-3 w-full rounded-xl border border-gray-200 p-2 text-sm"
            rows={3}
          />
          <div className="mt-3 flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700">
              Fechar
            </button>
            <button
              type="button"
              onClick={handleSolicitarAcesso}
              disabled={!motivoSolicitacao.trim() || solicitando}
              className="rounded-xl bg-[#0097b2] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {solicitando ? 'Enviando...' : 'Solicitar acesso'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-3xl rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-bold text-gray-900">Documentos</div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))} className="rounded bg-gray-100 px-2 py-1 text-xs">
              -
            </button>
            <button type="button" onClick={() => setZoom((z) => Math.min(2, z + 0.1))} className="rounded bg-gray-100 px-2 py-1 text-xs">
              +
            </button>
            <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-sm font-semibold text-gray-600 hover:bg-gray-100">
              Fechar
            </button>
          </div>
        </div>
        <div className="mt-3 space-y-3">
          {docs.length === 0 ? <div className="rounded-xl border border-gray-200 p-4 text-sm text-gray-500">Sem documentos.</div> : null}
          {docs.map((doc) => (
            <div key={doc.label} className="rounded-xl border border-gray-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold text-gray-800">{doc.label}</div>
                <a href={doc.url} download className="rounded bg-gray-900 px-2 py-1 text-xs font-semibold text-white">
                  Download
                </a>
              </div>
              {doc.url.toLowerCase().endsWith('.pdf') ? (
                <iframe src={doc.url} className="h-64 w-full rounded border border-gray-200" title={doc.label} />
              ) : (
                <img src={doc.url} alt={doc.label} style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }} className="max-h-72 rounded border border-gray-200 object-contain" />
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onMarcarVerificado} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">
            Marcar como verificado
          </button>
        </div>
      </div>
    </div>
  )
}

