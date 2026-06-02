-- Leitura do mensageiro financeiro ADM (contador de não lidas) + Realtime

CREATE TABLE IF NOT EXISTS public.financeiro_conversa_leitura (
  usuario_id UUID NOT NULL REFERENCES public.usuarios (id) ON DELETE CASCADE,
  conversa_id UUID NOT NULL REFERENCES public.financeiro_conversas (id) ON DELETE CASCADE,
  visto_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (usuario_id, conversa_id)
);

CREATE INDEX IF NOT EXISTS idx_financeiro_conversa_leitura_usuario
  ON public.financeiro_conversa_leitura (usuario_id);

ALTER TABLE public.financeiro_conversa_leitura ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "financeiro_conversa_leitura proprio" ON public.financeiro_conversa_leitura;

CREATE POLICY "financeiro_conversa_leitura proprio" ON public.financeiro_conversa_leitura FOR ALL
USING (usuario_id = auth.uid())
WITH CHECK (usuario_id = auth.uid());

COMMENT ON TABLE public.financeiro_conversa_leitura IS 'Última visualização do alvo em conversa do mensageiro financeiro ADM.';

-- Realtime: badge do canal financeiro atualiza com novas mensagens ADM
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'financeiro_mensagens'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.financeiro_mensagens;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'financeiro_conversas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.financeiro_conversas;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'financeiro_conversa_leitura'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.financeiro_conversa_leitura;
  END IF;
END;
$$;
