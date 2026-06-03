-- Garante colunas de verificação/reprovação em turistas (ambientes onde a migração 20260327100000 não rodou por completo).

ALTER TABLE public.turistas
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pre_aprovado',
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
  ADD COLUMN IF NOT EXISTS docs_verificado_em TIMESTAMPTZ;

COMMENT ON COLUMN public.turistas.docs_verificado IS 'TRUE quando o ADM aprovou a documentação do turista';
