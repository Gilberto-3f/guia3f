-- Realtime: mensagens do Mensageiro ECOSSISTEMA (chat membro ↔ ADM)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'ecossistema_mensagens'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ecossistema_mensagens;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'ecossistema_conversas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ecossistema_conversas;
  END IF;
END;
$$;
