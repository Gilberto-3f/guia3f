ALTER TABLE public.stories
ADD COLUMN IF NOT EXISTS marcacoes JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS repost_story_id UUID REFERENCES public.stories (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stories_repost_story_id ON public.stories (repost_story_id);

DROP POLICY IF EXISTS "stories leitura autenticados" ON public.stories;

CREATE POLICY "stories leitura autenticados" ON public.stories FOR
SELECT
  USING (
    auth.role () = 'authenticated'
    AND (
      expira_em > NOW ()
      OR autor_id = auth.uid ()
    )
  );
