'use client'

import { useCallback, useEffect, useId, useState } from 'react'
import { Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useDocumentoDisponivel } from '@/hooks/useDocumentoDisponivel'
import { documentoIdentidadeValido } from '@/lib/documentoIdentidade'

const MAX_BYTES = 5 * 1024 * 1024
const ACCEPT = 'image/jpeg,image/png,application/pdf'

const textInputCls =
  'mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-black placeholder:text-gray-400 focus:border-[#0097b2] focus:outline-none focus:ring-2 focus:ring-[#0097b2]/30'

const MSG_VERIFICACAO_PENDENTE =
  'Verificação solicitada com sucesso! Seus documentos foram enviados e em breve um administrador fará a análise para liberação total da sua conta.'

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
 * @param {string} rotulo
 */
async function uploadProfDoc(file, userId, rotulo) {
  const ext = file.name.split('.').pop() || 'bin'
  const path = `documentos/${userId}/prof-${rotulo}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
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
 * @param {{ usuarioId: string | null, onConcluido?: () => void }} props
 */
export default function AnexarDocumentos({ usuarioId, onConcluido }) {
  const [nomeCompleto, setNomeCompleto] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [numeroDocumento, setNumeroDocumento] = useState('')
  const [identidade, setIdentidade] = useState(/** @type {File | null} */ (null))
  const [endereco, setEndereco] = useState(/** @type {File | null} */ (null))
  const [profissao, setProfissao] = useState(/** @type {File | null} */ (null))
  const [urlIdentidade, setUrlIdentidade] = useState('')
  const [urlEndereco, setUrlEndereco] = useState('')
  const [urlProfissao, setUrlProfissao] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagemVerificacao, setMensagemVerificacao] = useState('')

  const { documentoLimpo, status: documentoStatus, feedback: documentoFeedback } =
    useDocumentoDisponivel(numeroDocumento, usuarioId)

  useEffect(() => {
    if (!usuarioId) return
    let ativo = true
    void (async () => {
      // Alguns bancos antigos ainda não têm `profissionais.telefone`; tenta com fallback.
      const res1 = await supabase
        .from('profissionais')
        .select(
          'nome_completo, whatsapp, telefone, documento_identidade, documento_frente_url, comprovante_residencia_url, comprovante_profissao_url, status, documentos_enviados_em, docs_verificado',
        )
        .eq('usuario_id', usuarioId)
        .maybeSingle()

      const data =
        res1?.error
          ? (
              await supabase
                .from('profissionais')
                .select(
                  'nome_completo, whatsapp, documento_identidade, documento_frente_url, comprovante_residencia_url, comprovante_profissao_url, status, documentos_enviados_em, docs_verificado',
                )
                .eq('usuario_id', usuarioId)
                .maybeSingle()
            ).data
          : res1.data
      if (!ativo || !data) return
      setNomeCompleto(String(data.nome_completo ?? '').trim())
      const contato = String(data.whatsapp ?? data.telefone ?? '').trim()
      if (contato) setWhatsapp(contato)
      setNumeroDocumento(String(data.documento_identidade ?? '').trim())
      setUrlIdentidade(String(data.documento_frente_url ?? '').trim())
      setUrlEndereco(String(data.comprovante_residencia_url ?? '').trim())
      setUrlProfissao(String(data.comprovante_profissao_url ?? '').trim())

      const docsEnviados = Boolean(String(data.documentos_enviados_em ?? '').trim())
      const docsVerificado = Boolean(data.docs_verificado)
      const status = String(data.status ?? '').toLowerCase()
      if (docsEnviados && !docsVerificado && status !== 'aprovado') {
        setMensagemVerificacao(MSG_VERIFICACAO_PENDENTE)
      }
    })()
    return () => {
      ativo = false
    }
  }, [usuarioId])

  const onChangeArquivo =
    (setter) =>
    /** @param {File | null} f */
    (f) => {
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
    if (!usuarioId) {
      setErro('Sessão inválida.')
      return
    }
    const nome = nomeCompleto.trim()
    const wa = whatsapp.trim()
    if (!nome) {
      setErro('Informe o nome completo.')
      return
    }
    if (!wa) {
      setErro('Informe o WhatsApp.')
      return
    }
    if (!documentoIdentidadeValido(documentoLimpo)) {
      setErro('Informe o número do documento de identidade (mesmo da foto anexada).')
      return
    }
    if (documentoStatus !== 'available') {
      setErro(
        documentoStatus === 'checking'
          ? 'Aguarde a verificação do número do documento.'
          : documentoFeedback || 'Este documento já está vinculado a outra conta.',
      )
      return
    }
    if (!identidade || !endereco || !profissao) {
      setErro('Envie os três documentos obrigatórios.')
      return
    }
    for (const pair of [
      [identidade, 'identidade'],
      [endereco, 'endereco'],
      [profissao, 'profissao'],
    ]) {
      const v = validarArquivo(/** @type {File} */ (pair[0]))
      if (v) {
        setErro(v)
        return
      }
    }

    setEnviando(true)
    try {
      const [uId, uEnd, uProf] = await Promise.all([
        uploadProfDoc(identidade, usuarioId, 'identidade'),
        uploadProfDoc(endereco, usuarioId, 'endereco'),
        uploadProfDoc(profissao, usuarioId, 'profissao'),
      ])

      const agora = new Date().toISOString()
      const { error: upErr } = await supabase
        .from('profissionais')
        .update({
          nome_completo: nome,
          whatsapp: wa,
          documento_identidade: documentoLimpo,
          documento_frente_url: uId,
          documento_verso_url: null,
          comprovante_residencia_url: uEnd,
          comprovante_profissao_url: uProf,
          documentos_enviados_em: agora,
          status: 'aguardando_analise',
          docs_verificado: false,
          docs_verificado_por: null,
          docs_verificado_em: null,
        })
        .eq('usuario_id', usuarioId)

      if (upErr) {
        const msg = upErr.message.toLowerCase()
        if (msg.includes('documento_identidade') || msg.includes('unique')) {
          throw new Error('Este documento já está vinculado a outra conta.')
        }
        throw new Error(upErr.message)
      }

      setUrlIdentidade(uId)
      setUrlEndereco(uEnd)
      setUrlProfissao(uProf)
      setIdentidade(null)
      setEndereco(null)
      setProfissao(null)

      setMensagemVerificacao(MSG_VERIFICACAO_PENDENTE)
      try {
        window.dispatchEvent(new CustomEvent('profissional-gate-refresh'))
        window.dispatchEvent(new CustomEvent('perfil-atualizado'))
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
    nomeCompleto,
    whatsapp,
    documentoLimpo,
    documentoStatus,
    documentoFeedback,
    identidade,
    endereco,
    profissao,
    onConcluido,
  ])

  /**
   * @param {{ label: string, file: File | null, onChange: (f: File | null) => void, jaAnexado?: boolean }} props
   */
  function CampoArquivo({ label, file, onChange, jaAnexado = false }) {
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
            accept={ACCEPT}
            className="sr-only"
            onChange={(e) => {
              onChange(e.target.files?.[0] ?? null)
              e.target.value = ''
            }}
          />
          {file ? <span className="sr-only">Arquivo: {file.name}</span> : null}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 text-gray-900">
      <h2 className="text-lg font-bold text-[#001f3f]">Anexar documentos</h2>

      {erro ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{erro}</div> : null}

      <div className="space-y-3">
        <label className="block text-sm font-semibold text-gray-800">
          Nome completo
          <input
            type="text"
            value={nomeCompleto}
            onChange={(e) => {
              setErro('')
              setNomeCompleto(e.target.value)
            }}
            className={textInputCls}
            autoComplete="name"
            placeholder="Seu nome completo"
          />
        </label>
        <label className="block text-sm font-semibold text-gray-800">
          WhatsApp
          <input
            type="tel"
            value={whatsapp}
            onChange={(e) => {
              setErro('')
              setWhatsapp(e.target.value)
            }}
            className={textInputCls}
            autoComplete="tel"
            placeholder="(00) 00000-0000"
            inputMode="tel"
          />
        </label>
      </div>

      <div className="space-y-3">
        <label className="block text-sm font-semibold text-gray-800">
          Número do documento de identidade
          <input
            type="text"
            value={numeroDocumento}
            onChange={(e) => {
              setErro('')
              setNumeroDocumento(e.target.value)
            }}
            className={textInputCls}
            autoComplete="off"
            placeholder="CPF, RG ou CI (mesmo número da foto)"
            inputMode="text"
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
              Digite o número exatamente como aparece no documento anexado. Cada documento pode ser
              vinculado a apenas uma conta.
            </p>
          )}
        </label>
        <CampoArquivo
          label="Documento de identificação"
          file={identidade}
          onChange={onChangeArquivo(setIdentidade)}
          jaAnexado={Boolean(urlIdentidade)}
        />
        <CampoArquivo
          label="Comprovante de endereço"
          file={endereco}
          onChange={onChangeArquivo(setEndereco)}
          jaAnexado={Boolean(urlEndereco)}
        />
        <CampoArquivo
          label="Comprovante de profissão"
          file={profissao}
          onChange={onChangeArquivo(setProfissao)}
          jaAnexado={Boolean(urlProfissao)}
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
