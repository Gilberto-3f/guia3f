ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS bairro TEXT;

COMMENT ON COLUMN public.empresas.bairro IS 'Bairro ou distrito do endereço comercial';
