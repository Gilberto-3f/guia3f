-- Garante schema para avisos de pré-liberação no canal financeiro do profissional.

ALTER TABLE public.canal_financeiro
  ALTER COLUMN empresa_id DROP NOT NULL;

ALTER TABLE public.canal_financeiro
  ADD COLUMN IF NOT EXISTS metadata JSONB NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.canal_financeiro.metadata IS
  'Dados extras (ex.: solicitação de pré-liberação turista).';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'turista_pre_liberacoes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.turista_pre_liberacoes;
  END IF;
END $$;
