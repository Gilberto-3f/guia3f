-- Disponibilidade de quartos (segmento Hospedagem)
ALTER TABLE public.empresas
ADD COLUMN IF NOT EXISTS hospedagem_disponibilidade TEXT
CHECK (
  hospedagem_disponibilidade IS NULL
  OR hospedagem_disponibilidade IN ('livre', 'lotado')
);

COMMENT ON COLUMN public.empresas.hospedagem_disponibilidade IS 'Capacidade informada pelo anfitrião: livre (quartos livres) ou lotado.';
