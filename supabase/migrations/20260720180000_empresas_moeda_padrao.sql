-- Moeda padrão do catálogo de lojas (Botão Dinâmico / mini-cards)
ALTER TABLE public.empresas
ADD COLUMN IF NOT EXISTS moeda_padrao TEXT NOT NULL DEFAULT 'USD';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'empresas_moeda_padrao_check'
  ) THEN
    ALTER TABLE public.empresas
    ADD CONSTRAINT empresas_moeda_padrao_check
    CHECK (moeda_padrao IN ('USD', 'BRL', 'ARS', 'PYG'));
  END IF;
END
$$;

COMMENT ON COLUMN public.empresas.moeda_padrao IS
  'Moeda de cadastro/exibição dos produtos do catálogo (USD|BRL|ARS|PYG). preco_usd permanece canônico.';
