-- Denúncias contra stories (alvo = linha em `stories`) + insert para utilizadores autenticados
-- e remoção de story por admins (moderação).

ALTER TABLE public.denuncias DROP CONSTRAINT IF EXISTS denuncias_denunciado_tipo_check;
ALTER TABLE public.denuncias ADD CONSTRAINT denuncias_denunciado_tipo_check
  CHECK (denunciado_tipo IN ('turista', 'profissional', 'empresa', 'story'));

DROP POLICY IF EXISTS denuncias_insert_reporter_story ON public.denuncias;
CREATE POLICY denuncias_insert_reporter_story ON public.denuncias
  FOR INSERT TO authenticated
  WITH CHECK (
    denunciado_tipo = 'story'
    AND denunciante_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.stories s
      WHERE s.id = denunciado_id
        AND s.autor_id IS DISTINCT FROM auth.uid()
    )
  );

-- Moderadores passam a incluir denúncias de stories (conteúdo).
DROP POLICY IF EXISTS denuncias_moderador ON public.denuncias;
CREATE POLICY denuncias_moderador ON public.denuncias
  FOR ALL USING (
    auth.uid() IN (
      SELECT id
      FROM public.usuarios
      WHERE admin_level = 2
        AND admin_permissoes->>'comunidade' IS NOT NULL
    )
    AND denunciado_tipo IN ('profissional', 'story')
  );

-- Apagar story na moderação (além do autor, que já tem policy própria).
DROP POLICY IF EXISTS "stories delete moderacao admin" ON public.stories;
CREATE POLICY "stories delete moderacao admin" ON public.stories
  FOR DELETE TO authenticated
  USING (
    auth.uid() IN (SELECT id FROM public.usuarios WHERE admin_level IN (1, 2))
  );
