-- Link do app parceiro para o botão APP PARCEIRO (Espaço Profissional / motorista_app).
-- Distinto de api_mobilidade_url (API para redirecionar contratantes).
ALTER TABLE public.config_apis
  ADD COLUMN IF NOT EXISTS app_parceiro_link TEXT;

COMMENT ON COLUMN public.config_apis.app_parceiro_link IS
  'URL do app parceiro (loja / deep link) aberta pelo botão APP PARCEIRO no Espaço Profissional.';
