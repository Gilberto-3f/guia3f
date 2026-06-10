'use client'

import { useCallback, useEffect, useId, useState } from 'react'
import { Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useDocumentoDisponivel } from '@/hooks/useDocumentoDisponivel'
import { documentoIdentidadeValido } from '@/lib/documentoIdentidade'
import { MSG_VERIFICACAO_PENDENTE } from '@/lib/mensagemVerificacaoDocumentos'

const MAX_BYTES = 5 * 1024 * 1024
const ACCEPT = 'image/jpeg,image/png,application/pdf'

/**
 * @param {File} file
 */
function validarArquivo(file) {
  if (!file || file.size === 0) return 'Selecione um arquivo.'
  if (file.size > MAX_BYTES) return 'Arquivo acima de 5 MB.'
  const ok =
    file.type === 'image/jpeg' ||
    file.type === 'image/png' ||
    file.type === 'application/pdf' ||
    /\.pdf$/i.test(file.name)
  if (!ok) return 'Use JPG, PNG ou PDF.'
  return ''
}

/**
 * @param {File} file
 * @param {string} userId
 * @param {string} empresaId
 * @param {string} rotulo
 */
async function uploadEmpresaDoc(file, userId, empresaId, rotulo) {
  const ext = file.name.split('.').pop() || 'bin'
  const path = `documentos/${userId}/empresa-${empresaId}-${rotulo}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage.from('documentos').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'application/octet-stream',
  })
  if (error) throw new Error(error.message)
  const { data } = supabase.storage.from('documentos').getPublicUrl(path)
  return data.publicUrl
}

/**
 * @param {{ label: string, file: File | null, onChange: (f: File | null) => void, accept?: string, jaAnexado?: boolean }} props
 */
function CampoArquivo({ label, file, onChange, accept = ACCEPT, jaAnexado = false }) {
  const inputId = useId()
  const mostrarCheck = jaAnexado || Boolean(file)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="min-w-0 flex-1 text-sm font-semibold text-gray-800">{label}</span>
      <div className="flex shrink-0 items-center gap-2">
        {mostrarCheck ? (
          <Check
            className="h-5 w-5 text-emerald-400"
            strokeWidth={3}
            aria-hidden
            title="Arquivo anexado"
          />
        ) : null}
        <label
          htmlFor={inputId}
          className="cursor-pointer rounded-md bg-[#0097b2] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#007d94]"
        >
          Escolher arquivo
        </label>
        <input
          id={inputId}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null
            onChange(f)
            e.target.value = ''
          }}
        />
        {file ? <span className="sr-only">Arquivo: {file.name}</span> : null}
      </div>
    </div>
  )
}

/**
 * @param {{
 *   empresaId: string | null
 *   usuarioId: string | null
 *   nomeFantasiaInicial?: string | null
 *   documentoFiscalInicial?: string | null
 *   onConcluido?: () => void
 * }} props
 */
export default function AnexarDocumentosEmpresa({
  empresaId,
  usuarioId,
  nomeFantasiaInicial = '',
  documentoFiscalInicial = '',
  onConcluido,
}) {
  const [nomeFantasia, setNomeFantasia] = useState(String(nomeFantasiaInicial ?? ''))
  const [documentoFiscal, setDocumentoFiscal] = useState(String(documentoFiscalInicial ?? ''))
  const [endereco, setEndereco] = useState(/** @type {File | null} */ (null))
  const [comercial, setComercial] = useState(/** @type {File | null} */ (null))
  const [urlEndereco, setUrlEndereco] = useState('')
  const [urlComercial, setUrlComercial] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagemVerificacao, setMensagemVerificacao] = useState('')

  const { documentoLimpo, status: documentoStatus, feedback: documentoFeedback } =
    useDocumentoDisponivel(documentoFiscal, usuarioId, { tipo: 'fiscal', empresaId })

  useEffect(() => {
    if (!empresaId) return
    let ativo = true
    void (async () => {
      const { data } = await supabase
        .from('empresas')
        .select(
          'nome_fantasia, documento_fiscal, comprovante_residencia_url, documento_comercial_url, documentos_enviados_em, docs_verificado, status',
        )
        .eq('id', empresaId)
        .maybeSingle()
      if (!ativo || !data) return
      if (data.nome_fantasia) setNomeFantasia(String(data.nome_fantasia))
      const fiscal =
        data.documento_fiscal != null
          ? String(data.documento_fiscal)
          : ''
      if (fiscal) setDocumentoFiscal(fiscal)
      setUrlEndereco(String(data.comprovante_residencia_url ?? '').trim())
      setUrlComercial(String(data.documento_comercial_url ?? '').trim())

      const docsEnviados = Boolean(String(data.documentos_enviados_em ?? '').trim())
      const docsVerificado = Boolean(data.docs_verificado)
      const status = String(data.status ?? '').toLowerCase()
      if (docsEnviados && !docsVerificado && status !== 'aprovado' && status !== 'ativo') {
        setMensagemVerificacao(MSG_VERIFICACAO_PENDENTE)
      }
    })()
    return () => {
      ativo = false
    }
  }, [empresaId])

  const onChangeArquivo =
    (setter) =>
    /** @param {File | null} f */ (f) => {
      setErro('')
      if (!f) {
        setter(null)
        return
      }
      const v = validarArquivo(f)
      if (v) {
        setErro(v)
        setter(null)
        return
      }
      setter(f)
    }

  const enviar = useCallback(async () => {
    setErro('')
    if (!usuarioId || !empresaId) {
      setErro('Sessão inválida.')
      return
    }
    if (!nomeFantasia.trim()) {
      setErro('Informe o nome fantasia.')
      return
    }
    if (!documentoIdentidadeValido(documentoLimpo)) {
      setErro('Informe o CNPJ, RUC ou CUIT (documento fiscal da empresa).')
      return
    }
    if (documentoStatus !== 'available') {
      setErro(
        documentoStatus === 'checking'
          ? 'Aguarde a verificação do documento fiscal.'
          : documentoFeedback || 'Este documento fiscal já está vinculado a outra empresa.',
      )
      return
    }
    if (!endereco || !comercial) {
      setErro('Envie o comprovante de endereço e o documento comercial.')
      return
    }
    for (const f of [endereco, comercial]) {
      const v = validarArquivo(f)
      if (v) {
        setErro(v)
        return
      }
    }

    setEnviando(true)
    try {
      const [uEndereco, uComercial] = await Promise.all([
        uploadEmpresaDoc(endereco, usuarioId, empresaId, 'comprovante-endereco'),
        uploadEmpresaDoc(comercial, usuarioId, empresaId, 'doc-comercial'),
      ])

      const agora = new Date().toISOString()
      const { error: upErr } = await supabase
        .from('empresas')
        .update({
          nome_fantasia: nomeFantasia.trim(),
          documento_fiscal: documentoLimpo,
          comprovante_residencia_url: uEndereco,
          documento_comercial_url: uComercial,
          documentos_enviados_em: agora,
          status: 'aguardando_aprovacao',
          docs_verificado: false,
        })
        .eq('id', empresaId)
        .eq('usuario_id', usuarioId)

      if (upErr) throw new Error(upErr.message)

      try {
        await supabase.from('usuarios').update({ status: 'pre_aprovado' }).eq('id', usuarioId)
      } catch {
        /* RLS ou coluna ausente — envio de documentos já foi gravado */
      }

      setUrlEndereco(uEndereco)
      setUrlComercial(uComercial)
      setEndereco(null)
      setComercial(null)

      setMensagemVerificacao(MSG_VERIFICACAO_PENDENTE)
      try {
        window.dispatchEvent(new Event('perfil-atualizado'))
        window.dispatchEvent(new Event('empresa-gate-refresh'))
      } catch {
        /* ignore */
      }
      onConcluido?.()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao enviar.')
    } finally {
      setEnviando(false)
    }
  }, [
    usuarioId,
    empresaId,
    nomeFantasia,
    documentoLimpo,
    documentoStatus,
    documentoFeedback,
    endereco,
    comercial,
    onConcluido,
  ])

  const inputTextoCls =
    'mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-[#0097b2] focus:ring-1 focus:ring-[#0097b2]'

  return (
    <div className="space-y-5 text-gray-900">
      <h2 className="text-lg font-bold text-[#001f3f]">Anexar documentos</h2>

      {erro ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{erro}</div> : null}

      <div className="space-y-4">
        <label className="block">
          <span className="text-sm font-semibold text-gray-800">Nome fantasia</span>
          <input
            type="text"
            value={nomeFantasia}
            onChange={(e) => setNomeFantasia(e.target.value)}
            placeholder="Nome da empresa"
            className={inputTextoCls}
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-gray-800">CNPJ / RUC / CUIT</span>
          <input
            type="text"
            value={documentoFiscal}
            onChange={(e) => {
              setErro('')
              setDocumentoFiscal(e.target.value)
            }}
            placeholder="Documento fiscal da empresa"
            className={inputTextoCls}
          />
          {documentoFeedback ? (
            <p
              className={`mt-1 text-xs ${
                documentoStatus === 'available'
                  ? 'text-emerald-700'
                  : documentoStatus === 'checking'
                    ? 'text-gray-600'
                    : documentoStatus === 'unavailable'
                      ? 'text-rose-700'
                      : 'text-gray-600'
              }`}
            >
              {documentoFeedback}
            </p>
          ) : (
            <p className="mt-1 text-xs text-gray-500">
              Cada documento fiscal pode ser vinculado a apenas uma empresa no sistema.
            </p>
          )}
        </label>

        <CampoArquivo
          label="Comprovante de endereço"
          file={endereco}
          onChange={onChangeArquivo(setEndereco)}
          jaAnexado={Boolean(urlEndereco)}
        />
        <CampoArquivo
          label="Documento comercial"
          file={comercial}
          onChange={onChangeArquivo(setComercial)}
          jaAnexado={Boolean(urlComercial)}
        />
      </div>

      <button
        type="button"
        disabled={enviando}
        onClick={() => void enviar()}
        className="w-full rounded-xl py-3 text-base font-bold text-white shadow-sm transition hover:brightness-95 disabled:opacity-60"
        style={{ backgroundColor: '#00D443' }}
      >
        {enviando ? 'Enviando…' : 'ENVIAR PARA ANÁLISE'}
      </button>

      {mensagemVerificacao ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm leading-relaxed text-emerald-800">
          {mensagemVerificacao}
        </div>
      ) : null}
    </div>
  )
}
