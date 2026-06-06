-- DDD do WhatsApp do turista (exibição mascarada no relatório da empresa).
ALTER TABLE public.recomendacoes
ADD COLUMN IF NOT EXISTS turista_whatsapp_ddd CHAR(2);

COMMENT ON COLUMN public.recomendacoes.turista_whatsapp_ddd IS 'DDD do WhatsApp do turista indicado na recomendação (somente para máscara no relatório).';
