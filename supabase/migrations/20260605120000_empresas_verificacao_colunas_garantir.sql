-- Garante colunas de verificação/reprovação em empresas (ambientes onde a migração 20260327100000 não rodou por completo).

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'aguardando_aprovacao',
  ADD COLUMN IF NOT EXISTS motivo_reprovacao TEXT,
  ADD COLUMN IF NOT EXISTS prazo_reenvio_dias INTEGER DEFAULT 7,
  ADD COLUMN IF NOT EXISTS reprovado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reprovado_por UUID REFERENCES public.usuarios (id),
  ADD COLUMN IF NOT EXISTS verificado_por UUID REFERENCES public.usuarios (id),
  ADD COLUMN IF NOT EXISTS verificado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS aprovado_por UUID REFERENCES public.usuarios (id),
  ADD COLUMN IF NOT EXISTS aprovado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS docs_verificado BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS docs_verificado_por UUID REFERENCES public.usuarios (id),
  ADD COLUMN IF NOT EXISTS docs_verificado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS documento_fiscal TEXT,
  ADD COLUMN IF NOT EXISTS comprovante_residencia_url TEXT,
  ADD COLUMN IF NOT EXISTS documento_comercial_url TEXT,
  ADD COLUMN IF NOT EXISTS documentos_enviados_em TIMESTAMPTZ;

COMMENT ON COLUMN public.empresas.documentos_enviados_em IS 'Quando a empresa enviou o lote de documentos para análise';
