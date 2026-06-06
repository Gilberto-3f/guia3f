-- Últimos 4 dígitos do WhatsApp do turista prospectado (privacidade no relatório da empresa).
ALTER TABLE public.recomendacoes
ADD COLUMN IF NOT EXISTS turista_whatsapp_final CHAR(4);

COMMENT ON COLUMN public.recomendacoes.turista_whatsapp_final IS 'Últimos 4 dígitos do WhatsApp do turista indicado na recomendação.';
