-- Documentação profissional (anexos pós-cadastro), revisão semestral e fila admin

ALTER TABLE public.profissionais
  ADD COLUMN IF NOT EXISTS documento_frente_url TEXT;

ALTER TABLE public.profissionais
  ADD COLUMN IF NOT EXISTS comprovante_residencia_url TEXT;

ALTER TABLE public.profissionais
  ADD COLUMN IF NOT EXISTS comprovante_profissao_url TEXT;

ALTER TABLE public.profissionais
  ADD COLUMN IF NOT EXISTS documentos_enviados_em TIMESTAMPTZ;

ALTER TABLE public.profissionais
  ADD COLUMN IF NOT EXISTS ultima_revisao_docs_em TIMESTAMPTZ;

ALTER TABLE public.profissionais
  ADD COLUMN IF NOT EXISTS proxima_revisao_docs_em TIMESTAMPTZ;

COMMENT ON COLUMN public.profissionais.documento_frente_url IS 'RG/CNH frente (URL pública storage)';
COMMENT ON COLUMN public.profissionais.comprovante_residencia_url IS 'Comprovante de residência';
COMMENT ON COLUMN public.profissionais.comprovante_profissao_url IS 'Comprovante de exercício da profissão';
COMMENT ON COLUMN public.profissionais.documentos_enviados_em IS 'Quando o profissional enviou lote para análise (fila admin)';
COMMENT ON COLUMN public.profissionais.ultima_revisao_docs_em IS 'Última análise/aprovação de documentos';
COMMENT ON COLUMN public.profissionais.proxima_revisao_docs_em IS 'Prazo para renovação obrigatória da documentação (ex.: +6 meses)';
