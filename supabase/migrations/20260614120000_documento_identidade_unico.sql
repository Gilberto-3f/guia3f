-- Número do documento de identidade (texto informado pelo usuário) para checagem de duplicata entre contas.

ALTER TABLE public.profissionais
  ADD COLUMN IF NOT EXISTS documento_identidade TEXT;

ALTER TABLE public.turistas
  ADD COLUMN IF NOT EXISTS documento_identidade TEXT;

COMMENT ON COLUMN public.profissionais.documento_identidade IS
  'Número do documento de identidade informado pelo usuário (mesmo da foto anexada).';

COMMENT ON COLUMN public.turistas.documento_identidade IS
  'Número do documento de identidade informado pelo usuário (mesmo da foto anexada).';

CREATE UNIQUE INDEX IF NOT EXISTS idx_profissionais_documento_identidade_norm
  ON public.profissionais (
    lower(regexp_replace(documento_identidade, '[^a-zA-Z0-9]', '', 'g'))
  )
  WHERE documento_identidade IS NOT NULL
    AND trim(documento_identidade) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_turistas_documento_identidade_norm
  ON public.turistas (
    lower(regexp_replace(documento_identidade, '[^a-zA-Z0-9]', '', 'g'))
  )
  WHERE documento_identidade IS NOT NULL
    AND trim(documento_identidade) <> '';
