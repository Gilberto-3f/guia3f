-- Participantes da conversa podem ler visto_em do outro lado (recibo "Visto" no chat).

DROP POLICY IF EXISTS ecossistema_leitura_participante_select ON public.ecossistema_conversa_leitura;

CREATE POLICY ecossistema_leitura_participante_select ON public.ecossistema_conversa_leitura FOR SELECT TO authenticated
USING (
  usuario_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.ecossistema_conversas c
    WHERE c.id = conversa_id
      AND (
        c.membro_usuario_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.role = 'admin')
      )
  )
);

DROP POLICY IF EXISTS financeiro_leitura_participante_select ON public.financeiro_conversa_leitura;

CREATE POLICY financeiro_leitura_participante_select ON public.financeiro_conversa_leitura FOR SELECT TO authenticated
USING (
  usuario_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.financeiro_conversas c
    WHERE c.id = conversa_id
      AND (
        c.alvo_usuario_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.role = 'admin')
      )
  )
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'ecossistema_conversa_leitura'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ecossistema_conversa_leitura;
  END IF;
END;
$$;
