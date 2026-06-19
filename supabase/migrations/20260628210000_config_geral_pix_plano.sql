-- PIX copia e cola para pagamento de planos (empresa).

ALTER TABLE public.config_geral
ADD COLUMN IF NOT EXISTS pix_copia_cola TEXT;

COMMENT ON COLUMN public.config_geral.pix_copia_cola IS 'Código PIX copia e cola exibido na contratação de planos.';
