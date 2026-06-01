-- Profissionais: campo de telefone usado no fluxo "Anexar documentos"

ALTER TABLE public.profissionais
  ADD COLUMN IF NOT EXISTS telefone TEXT;

COMMENT ON COLUMN public.profissionais.telefone IS 'Telefone de contato (fallback para WhatsApp quando aplicável).';

