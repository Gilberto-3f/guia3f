ALTER TABLE public.turistas
  ADD COLUMN IF NOT EXISTS whatsapp TEXT;

COMMENT ON COLUMN public.turistas.whatsapp IS 'WhatsApp de contato do turista (anexo de documentos no menu).';
