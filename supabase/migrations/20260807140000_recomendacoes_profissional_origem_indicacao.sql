-- Origem da indicação profissional→profissional (cartão de visita vs drawer Ecossistema).
ALTER TABLE public.recomendacoes_profissional
  ADD COLUMN IF NOT EXISTS origem_indicacao TEXT;

COMMENT ON COLUMN public.recomendacoes_profissional.origem_indicacao IS
  'cartao_visita | ecossistema — canal de origem da recomendação.';

-- Legado sem origem: tratar como cartão de visita (contam sempre no histórico).
UPDATE public.recomendacoes_profissional
SET origem_indicacao = 'cartao_visita'
WHERE origem_indicacao IS NULL;

ALTER TABLE public.recomendacoes_profissional
  ALTER COLUMN origem_indicacao SET DEFAULT 'cartao_visita';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'recomendacoes_profissional_origem_indicacao_check'
  ) THEN
    ALTER TABLE public.recomendacoes_profissional
      ADD CONSTRAINT recomendacoes_profissional_origem_indicacao_check
      CHECK (origem_indicacao IN ('cartao_visita', 'ecossistema'));
  END IF;
END $$;
