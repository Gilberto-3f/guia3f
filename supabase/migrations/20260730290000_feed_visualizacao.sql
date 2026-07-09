-- Visualização de posts no feed (fila dinâmica por usuário; sincroniza entre dispositivos).

CREATE TABLE IF NOT EXISTS public.feed_visualizacao (
  usuario_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts (id) ON DELETE CASCADE,
  visto_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_feed_visualizacao_usuario ON public.feed_visualizacao (usuario_id);

CREATE INDEX IF NOT EXISTS idx_feed_visualizacao_post ON public.feed_visualizacao (post_id);

ALTER TABLE public.feed_visualizacao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feed_visualizacao select proprio" ON public.feed_visualizacao;

DROP POLICY IF EXISTS "feed_visualizacao insert proprio" ON public.feed_visualizacao;

CREATE POLICY "feed_visualizacao select proprio" ON public.feed_visualizacao FOR
SELECT
  USING (usuario_id = auth.uid ());

CREATE POLICY "feed_visualizacao insert proprio" ON public.feed_visualizacao FOR INSERT
WITH
  CHECK (usuario_id = auth.uid ());

GRANT
SELECT,
INSERT
  ON public.feed_visualizacao TO authenticated;
