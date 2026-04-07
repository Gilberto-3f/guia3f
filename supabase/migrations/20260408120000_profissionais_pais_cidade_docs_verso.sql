-- Campos de cadastro profissional: país, cidades de atuação, documento verso
ALTER TABLE public.profissionais
  ADD COLUMN IF NOT EXISTS pais TEXT;

ALTER TABLE public.profissionais
  ADD COLUMN IF NOT EXISTS cidade_atuacao TEXT[];

ALTER TABLE public.profissionais
  ADD COLUMN IF NOT EXISTS documento_verso_url TEXT;

COMMENT ON COLUMN public.profissionais.pais IS 'País de atuação principal: Brasil, Paraguai ou Argentina';
COMMENT ON COLUMN public.profissionais.cidade_atuacao IS 'Cidades de atuação (ex.: Tríplice Fronteira)';
COMMENT ON COLUMN public.profissionais.documento_verso_url IS 'URL do documento de identidade (verso)';
