-- Alinha nomes de colunas com o app (analisado_*). Evita 400 do PostgREST quando
-- a tabela foi criada/alterada manualmente com o typo canalisado_*.

ALTER TABLE public.denuncias ADD COLUMN IF NOT EXISTS analisado_em TIMESTAMPTZ;
ALTER TABLE public.denuncias ADD COLUMN IF NOT EXISTS analisado_por UUID REFERENCES public.usuarios (id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'denuncias'
      AND column_name = 'canalisado_em'
  ) THEN
    UPDATE public.denuncias
    SET analisado_em = COALESCE(analisado_em, canalisado_em);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'denuncias'
      AND column_name = 'canalisado_por'
  ) THEN
    UPDATE public.denuncias
    SET analisado_por = COALESCE(analisado_por, canalisado_por);
  END IF;
END $$;
