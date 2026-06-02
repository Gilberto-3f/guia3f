'use client'

import { useCallback, useEffect, useId, useState } from 'react'
import { Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'

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
  const [okMsg, setOkMsg] = useState('')

  useEffect(() => {
    if (!empresaId) return
    let ativo = true
    void (async () => {
      const { data } = await supabase
        .from('empresas')
        .select('nome_fantasia, documento_fiscal, comprovante_residencia_url, documento_comercial_url')
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
    })()
    return () => {
      ativo = false
    }
  }, [empresaId])

  const onChangeArquivo =
    (setter) =>
    /** @param {File | null} f */ (f) => {
      setErro('')
      setOkMsg('')
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
    setOkMsg('')
    if (!usuarioId || !empresaId) {
      setErro('Sessão inválida.')
      return
    }
    if (!nomeFantasia.trim()) {
      setErro('Informe o nome fantasia.')
      return
    }
    if (!documentoFiscal.trim()) {
      setErro('Informe o CNPJ, RUC ou CUIT.')
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
          documento_fiscal: documentoFiscal.trim(),
          comprovante_residencia_url: uEndereco,
          documento_comercial_url: uComercial,
          documentos_enviados_em: agora,
        })
        .eq('id', empresaId)
        .eq('usuario_id', usuarioId)

      if (upErr) throw new Error(upErr.message)

      setUrlEndereco(uEndereco)
      setUrlComercial(uComercial)
      setEndereco(null)
      setComercial(null)

      setOkMsg('Documentos enviados com sucesso! Aguarde a análise do administrador.')
      try {
        window.dispatchEvent(new Event('perfil-atualizado'))
      } catch {
        /* ignore */
      }
      onConcluido?.()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao enviar.')
    } finally {
      setEnviando(false)
    }
  }, [usuarioId, empresaId, nomeFantasia, documentoFiscal, endereco, comercial, onConcluido])

  const inputTextoCls =
    'mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-[#0097b2] focus:ring-1 focus:ring-[#0097b2]'

  return (
    <div className="space-y-5 text-gray-900">
      <h2 className="text-lg font-bold text-[#001f3f]">Anexar documentos</h2>

      {erro ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{erro}</div> : null}
      {okMsg ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{okMsg}</div>
      ) : null}

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
            onChange={(e) => setDocumentoFiscal(e.target.value)}
            placeholder="Documento fiscal da empresa"
            className={inputTextoCls}
          />
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
    </div>
  )
}
