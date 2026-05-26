-- Realtime: badge do ícone Canal na BottomBar atualiza ao chegar mensagem nova.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'mensagens_canal'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mensagens_canal;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'canal_leitura_profissional'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.canal_leitura_profissional;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'canal_financeiro'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.canal_financeiro;
  END IF;
END;
$$;
