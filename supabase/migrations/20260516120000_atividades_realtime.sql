-- Realtime: seguidores veem sumir curtidas na aba Amigos quando alguém descurte (trigger apaga a linha).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_publication_tables
    WHERE
      pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'atividades'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.atividades;
  END IF;
END;
$$;
