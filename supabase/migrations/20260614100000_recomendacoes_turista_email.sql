-- Canal e prefixo do e-mail do turista (recomendação por e-mail)
ALTER TABLE public.recomendacoes
  ADD COLUMN IF NOT EXISTS turista_canal text,
  ADD COLUMN IF NOT EXISTS turista_email_prefix text;

COMMENT ON COLUMN public.recomendacoes.turista_canal IS 'whatsapp | email — canal usado na recomendação.';
COMMENT ON COLUMN public.recomendacoes.turista_email_prefix IS '5 primeiras letras do e-mail do turista (recomendação por e-mail).';
