'use client'

import { useCallback, useEffect, useId, useState } from 'react'
import { Check } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { useDocumentoDisponivel } from '@/hooks/useDocumentoDisponivel'
import { documentoIdentidadeValido } from '@/lib/documentoIdentidade'
import { MSG_VERIFICACAO_PENDENTE } from '@/lib/mensagemVerificacaoDocumentos'

const MAX_BYTES = 5 * 1024 * 1024
const ACCEPT = 'image/jpeg,image/png,application/pdf'

const textInputCls =
  'mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-black placeholder:text-gray-400 focus:border-[#0097b2] focus:outline-none focus:ring-2 focus:ring-[#0097b2]/30'

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
async function uploadTuristaDoc(file, userId, rotulo) {
  const ext = file.name.split('.').pop() || 'bin'
  const path = `documentos/${userId}/tur-${rotulo}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
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
export default function AnexarDocumentosTurista({ usuarioId, onConcluido }) {
  const t = useTranslations('Cadastro.turista')
  const [nomeCompleto, setNomeCompleto] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [numeroDocumento, setNumeroDocumento] = useState('')
  const [documentoFrente, setDocumentoFrente] = useState(/** @type {File | null} */ (null))
  const [documentoVerso, setDocumentoVerso] = useState(/** @type {File | null} */ (null))
  const [urlFrente, setUrlFrente] = useState('')
  const [urlVerso, setUrlVerso] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagemVerificacao, setMensagemVerificacao] = useState('')
  const [modalDocumentoAberto, setModalDocumentoAberto] = useState(false)

  const { documentoLimpo, status: documentoStatus, feedback: documentoFeedback } =
    useDocumentoDisponivel(numeroDocumento, usuarioId)

  useEffect(() => {
    if (!usuarioId) return
    let ativo = true
    void (async () => {
      const res = await supabase
        .from('turistas')
        .select(
          'nome_completo, whatsapp, documento_identidade, documento_frente_url, documento_verso_url, status, docs_verificado, documentos_enviados_em',
        )
        .eq('usuario_id', usuarioId)
        .maybeSingle()

      if (res.error) {
        const fallback = await supabase
          .from('turistas')
          .select(
            'nome_completo, documento_identidade, documento_frente_url, documento_verso_url, status, docs_verificado',
          )
          .eq('usuario_id', usuarioId)
          .maybeSingle()
        if (!ativo || !fallback.data) return
        const data = fallback.data
        setNomeCompleto(String(data.nome_completo ?? '').trim())
        setNumeroDocumento(String(data.documento_identidade ?? '').trim())
        setUrlFrente(String(data.documento_frente_url ?? '').trim())
        setUrlVerso(String(data.documento_verso_url ?? '').trim())
        const temDocs = Boolean(data.documento_frente_url && data.documento_verso_url)
        const docsVerificado = Boolean(data.docs_verificado)
        const status = String(data.status ?? '').toLowerCase()
        if (temDocs && !docsVerificado && status !== 'aprovado' && status !== 'ativo') {
          setMensagemVerificacao(MSG_VERIFICACAO_PENDENTE)
        }
        return
      }

      if (!ativo || !res.data) return
      const data = res.data
      setNomeCompleto(String(data.nome_completo ?? '').trim())
      setWhatsapp(String(data.whatsapp ?? '').trim())
      setNumeroDocumento(String(data.documento_identidade ?? '').trim())
      setUrlFrente(String(data.documento_frente_url ?? '').trim())
      setUrlVerso(String(data.documento_verso_url ?? '').trim())

      const docsEnviados = Boolean(String(data.documentos_enviados_em ?? '').trim())
      const temDocs = Boolean(data.documento_frente_url && data.documento_verso_url)
      const docsVerificado = Boolean(data.docs_verificado)
      const status = String(data.status ?? '').toLowerCase()
      if ((docsEnviados || temDocs) && !docsVerificado && status !== 'aprovado' && status !== 'ativo') {
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
    if (!documentoFrente || !documentoVerso) {
      setErro('Envie o documento (frente e verso).')
      return
    }
    for (const pair of [
      [documentoFrente, 'frente'],
      [documentoVerso, 'verso'],
    ]) {
      const v = validarArquivo(/** @type {File} */ (pair[0]))
      if (v) {
        setErro(v)
        return
      }
    }

    setEnviando(true)
    try {
      const [uFrente, uVerso] = await Promise.all([
        uploadTuristaDoc(documentoFrente, usuarioId, 'frente'),
        uploadTuristaDoc(documentoVerso, usuarioId, 'verso'),
      ])

      const agora = new Date().toISOString()
      const payload = {
        nome_completo: nome,
        whatsapp: wa,
        documento_identidade: documentoLimpo,
        documento_frente_url: uFrente,
        documento_verso_url: uVerso,
        documentos_enviados_em: agora,
        status: 'aguardando_analise',
        docs_verificado: false,
      }

      let up = await supabase.from('turistas').update(payload).eq('usuario_id', usuarioId)

      if (up.error && up.error.message.toLowerCase().includes('whatsapp')) {
        const { whatsapp: _w, ...rest } = payload
        up = await supabase.from('turistas').update(rest).eq('usuario_id', usuarioId)
      }
      if (up.error && up.error.message.toLowerCase().includes('documentos_enviados_em')) {
        const { documentos_enviados_em: _d, ...rest } = payload
        up = await supabase.from('turistas').update(rest).eq('usuario_id', usuarioId)
      }
      if (up.error && up.error.message.toLowerCase().includes('status')) {
        const { status: _s, ...rest } = payload
        up = await supabase.from('turistas').update(rest).eq('usuario_id', usuarioId)
      }
      if (up.error && up.error.message.toLowerCase().includes('documento_identidade')) {
        throw new Error('Este documento já está vinculado a outra conta.')
      }

      if (up.error) throw new Error(up.error.message)

      setUrlFrente(uFrente)
      setUrlVerso(uVerso)
      setDocumentoFrente(null)
      setDocumentoVerso(null)
      setMensagemVerificacao(MSG_VERIFICACAO_PENDENTE)
      try {
        window.dispatchEvent(new CustomEvent('turista-gate-refresh'))
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
    documentoFrente,
    documentoVerso,
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
            <Check className="h-5 w-5 text-emerald-400" strokeWidth={3} aria-hidden title="Arquivo anexado" />
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

      <div>
        <div className="mb-2 flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800">Documento de identificação</span>
          <button
            type="button"
            aria-label={t('docWhyAria')}
            onClick={() => setModalDocumentoAberto(true)}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#001f3f] text-xs font-bold text-[#001f3f] hover:bg-[#001f3f] hover:text-white"
          >
            i
          </button>
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
            label="Frente"
            file={documentoFrente}
            onChange={onChangeArquivo(setDocumentoFrente)}
            jaAnexado={Boolean(urlFrente)}
          />
          <CampoArquivo
            label="Verso"
            file={documentoVerso}
            onChange={onChangeArquivo(setDocumentoVerso)}
            jaAnexado={Boolean(urlVerso)}
          />
        </div>
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

      {modalDocumentoAberto ? (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="doc-modal-turista-title"
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border-2 border-[#0097b2] bg-white p-6 shadow-xl">
            <h2 id="doc-modal-turista-title" className="mb-4 text-center text-lg font-bold text-[#0097b2]">
              {t('docModalTitle')}
            </h2>
            <div className="space-y-3 text-sm text-[#001f3f]">
              <p>{t('docModalP1')}</p>
              <p>
                <span className="font-bold">{t('docModalSecurity')}</span> {t('docModalSecurityText')}
              </p>
              <p>
                <span className="font-bold">{t('docModalData')}</span> {t('docModalDataText')}
              </p>
              <p>
                <span className="font-bold">{t('docModalEcon')}</span> {t('docModalEconText')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setModalDocumentoAberto(false)}
              className="mt-6 w-full rounded-full bg-[#0097b2] py-3 font-bold text-white hover:opacity-95"
            >
              {t('docModalOk')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
