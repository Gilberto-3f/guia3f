-- Canais independentes de API/app parceiro de mobilidade: Foz do Iguaçu e CDE.
-- Deslocamento urbano em cada cidade usa a config local (não compartilhada).

ALTER TABLE public.config_apis
  ADD COLUMN IF NOT EXISTS api_mobilidade_url_foz TEXT,
  ADD COLUMN IF NOT EXISTS api_mobilidade_key_foz TEXT,
  ADD COLUMN IF NOT EXISTS app_parceiro_link_foz TEXT,
  ADD COLUMN IF NOT EXISTS api_mobilidade_url_cde TEXT,
  ADD COLUMN IF NOT EXISTS api_mobilidade_key_cde TEXT,
  ADD COLUMN IF NOT EXISTS app_parceiro_link_cde TEXT;

COMMENT ON COLUMN public.config_apis.api_mobilidade_url_foz IS
  'URL API/app parceiro de mobilidade urbana — Foz do Iguaçu (deslocamentos dentro de Foz).';
COMMENT ON COLUMN public.config_apis.api_mobilidade_key_foz IS
  'API key do parceiro de mobilidade — Foz do Iguaçu.';
COMMENT ON COLUMN public.config_apis.app_parceiro_link_foz IS
  'Link loja/deep link do app parceiro para profissionais — Foz do Iguaçu.';
COMMENT ON COLUMN public.config_apis.api_mobilidade_url_cde IS
  'URL API/app parceiro de mobilidade urbana — Ciudad del Este (deslocamentos dentro de CDE).';
COMMENT ON COLUMN public.config_apis.api_mobilidade_key_cde IS
  'API key do parceiro de mobilidade — Ciudad del Este.';
COMMENT ON COLUMN public.config_apis.app_parceiro_link_cde IS
  'Link loja/deep link do app parceiro para profissionais — Ciudad del Este.';

-- Backfill a partir da config legada (global) para não quebrar ambientes já cadastrados.
UPDATE public.config_apis
SET
  api_mobilidade_url_foz = COALESCE(NULLIF(TRIM(api_mobilidade_url_foz), ''), api_mobilidade_url),
  api_mobilidade_key_foz = COALESCE(NULLIF(TRIM(api_mobilidade_key_foz), ''), api_mobilidade_key),
  app_parceiro_link_foz = COALESCE(NULLIF(TRIM(app_parceiro_link_foz), ''), app_parceiro_link),
  api_mobilidade_url_cde = COALESCE(NULLIF(TRIM(api_mobilidade_url_cde), ''), api_mobilidade_url),
  api_mobilidade_key_cde = COALESCE(NULLIF(TRIM(api_mobilidade_key_cde), ''), api_mobilidade_key),
  app_parceiro_link_cde = COALESCE(NULLIF(TRIM(app_parceiro_link_cde), ''), app_parceiro_link)
WHERE
  api_mobilidade_url IS NOT NULL
  OR api_mobilidade_key IS NOT NULL
  OR app_parceiro_link IS NOT NULL;
