-- Feed avançado: stories, comentários, curtidas, posts salvos, contagens

-- ========== posts: novas colunas (compatível com foto_url existente) ==========
ALTER TABLE posts
ADD COLUMN IF NOT EXISTS conteudo_url TEXT,
ADD COLUMN IF NOT EXISTS total_curtidas INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_comentarios INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_compartilhamentos INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS avaliacao_meta JSONB;

UPDATE posts
SET
  conteudo_url = foto_url
WHERE
  conteudo_url IS NULL
  AND foto_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_posts_deleted ON posts (deleted_at)
WHERE
  deleted_at IS NULL;

-- ========== stories ==========
CREATE TABLE IF NOT EXISTS stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  autor_id UUID NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  autor_tipo TEXT NOT NULL,
  tipo TEXT NOT NULL,
  conteudo_url TEXT NOT NULL,
  texto_sobreposto JSONB,
  link TEXT,
  duracao_segundos INTEGER DEFAULT 60,
  visualizado_por JSONB DEFAULT '[]'::jsonb,
  curtidas JSONB DEFAULT '[]'::jsonb,
  expira_em TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW ()
);

CREATE INDEX IF NOT EXISTS idx_stories_autor ON stories (autor_id);

CREATE INDEX IF NOT EXISTS idx_stories_expira ON stories (expira_em);

CREATE INDEX IF NOT EXISTS idx_stories_created ON stories (created_at DESC);

-- ========== comentarios ==========
CREATE TABLE IF NOT EXISTS comentarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  post_id UUID NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  autor_id UUID NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  curtidas JSONB DEFAULT '[]'::jsonb,
  total_curtidas INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW (),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_comentarios_post ON comentarios (post_id);

-- ========== curtidas (post OU comentário) ==========
CREATE TABLE IF NOT EXISTS curtidas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  usuario_id UUID NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts (id) ON DELETE CASCADE,
  comentario_id UUID REFERENCES comentarios (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW (),
  CONSTRAINT curtidas_um_ou_outro CHECK (
    (
      post_id IS NOT NULL
      AND comentario_id IS NULL
    )
    OR (
      post_id IS NULL
      AND comentario_id IS NOT NULL
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_curtidas_post_usuario ON curtidas (usuario_id, post_id)
WHERE
  post_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_curtidas_com_usuario ON curtidas (usuario_id, comentario_id)
WHERE
  comentario_id IS NOT NULL;

-- ========== posts salvos ==========
CREATE TABLE IF NOT EXISTS item_salvo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  usuario_id UUID NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  salvo_em TIMESTAMPTZ DEFAULT NOW (),
  UNIQUE (usuario_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_item_salvo_usuario ON item_salvo (usuario_id);

-- ========== Funções de contagem (SECURITY DEFINER) ==========
CREATE OR REPLACE FUNCTION refresh_post_curtidas_count (pid UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE posts
  SET
    total_curtidas = (
      SELECT
        COUNT(*)::INTEGER
      FROM
        curtidas
      WHERE
        post_id = pid
    )
  WHERE
    id = pid;

$$;

CREATE OR REPLACE FUNCTION refresh_comentario_curtidas_count (cid UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE comentarios
  SET
    total_curtidas = (
      SELECT
        COUNT(*)::INTEGER
      FROM
        curtidas
      WHERE
        comentario_id = cid
    )
  WHERE
    id = cid;

$$;

CREATE OR REPLACE FUNCTION trg_curtidas_post_after ()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.post_id IS NOT NULL THEN
      PERFORM refresh_post_curtidas_count (NEW.post_id);
    END IF;

    IF NEW.comentario_id IS NOT NULL THEN
      PERFORM refresh_comentario_curtidas_count (NEW.comentario_id);
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.post_id IS NOT NULL THEN
      PERFORM refresh_post_curtidas_count (OLD.post_id);
    END IF;

    IF OLD.comentario_id IS NOT NULL THEN
      PERFORM refresh_comentario_curtidas_count (OLD.comentario_id);
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_curtidas_post_count ON curtidas;

CREATE TRIGGER trg_curtidas_post_count
AFTER INSERT OR DELETE ON curtidas FOR EACH ROW
EXECUTE FUNCTION trg_curtidas_post_after ();

CREATE OR REPLACE FUNCTION refresh_post_comments_count (pid UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE posts
  SET
    total_comentarios = (
      SELECT
        COUNT(*)::INTEGER
      FROM
        comentarios
      WHERE
        post_id = pid
        AND deleted_at IS NULL
    )
  WHERE
    id = pid;

$$;

CREATE OR REPLACE FUNCTION trg_comentarios_after ()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM refresh_post_comments_count (NEW.post_id);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM refresh_post_comments_count (OLD.post_id);
  ELSIF TG_OP = 'UPDATE' AND OLD.deleted_at IS DISTINCT FROM NEW.deleted_at THEN
    PERFORM refresh_post_comments_count (NEW.post_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_comentarios_count ON comentarios;

CREATE TRIGGER trg_comentarios_count
AFTER INSERT OR DELETE OR
UPDATE ON comentarios FOR EACH ROW
EXECUTE FUNCTION trg_comentarios_after ();

-- Bucket stories
INSERT INTO
  storage.buckets (id, name, public)
VALUES
  ('stories', 'stories', TRUE)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "stories storage leitura" ON storage.objects;

DROP POLICY IF EXISTS "stories storage upload" ON storage.objects;

DROP POLICY IF EXISTS "stories storage delete" ON storage.objects;

CREATE POLICY "stories storage leitura" ON storage.objects FOR
SELECT
  USING (bucket_id = 'stories');

CREATE POLICY "stories storage upload" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'stories'
  AND (storage.foldername (name))[1] = auth.uid ()::text
);

CREATE POLICY "stories storage delete" ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'stories'
  AND (storage.foldername (name))[1] = auth.uid ()::text
);

-- ========== RLS posts: excluir soft-deleted da leitura normal ==========
DROP POLICY IF EXISTS "posts leitura autenticados" ON posts;

CREATE POLICY "posts leitura autenticados" ON posts FOR
SELECT
  USING (
    auth.role () = 'authenticated'
    AND deleted_at IS NULL
  );

-- RLS stories
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stories leitura autenticados" ON stories;

DROP POLICY IF EXISTS "stories insert autor" ON stories;

DROP POLICY IF EXISTS "stories update autor" ON stories;

DROP POLICY IF EXISTS "stories delete autor" ON stories;

CREATE POLICY "stories leitura autenticados" ON stories FOR
SELECT
  USING (
    auth.role () = 'authenticated'
    AND expira_em > NOW ()
  );

CREATE POLICY "stories insert autor" ON stories FOR INSERT
WITH CHECK (
  auth.role () = 'authenticated'
  AND autor_id = auth.uid ()
);

CREATE POLICY "stories update autor" ON stories FOR
UPDATE
  USING (autor_id = auth.uid ())
  WITH CHECK (autor_id = auth.uid ());

CREATE POLICY "stories delete autor" ON stories FOR DELETE USING (autor_id = auth.uid ());

-- RLS comentarios
ALTER TABLE comentarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comentarios select" ON comentarios;

DROP POLICY IF EXISTS "comentarios insert" ON comentarios;

DROP POLICY IF EXISTS "comentarios update own" ON comentarios;

DROP POLICY IF EXISTS "comentarios delete own" ON comentarios;

CREATE POLICY "comentarios select" ON comentarios FOR
SELECT
  USING (
    auth.role () = 'authenticated'
    AND deleted_at IS NULL
    AND EXISTS (
      SELECT
        1
      FROM
        posts p
      WHERE
        p.id = comentarios.post_id
        AND p.deleted_at IS NULL
    )
  );

CREATE POLICY "comentarios insert" ON comentarios FOR INSERT
WITH CHECK (
  auth.role () = 'authenticated'
  AND autor_id = auth.uid ()
  AND EXISTS (
    SELECT
      1
      FROM
        posts p
    WHERE
      p.id = post_id
      AND p.deleted_at IS NULL
  )
);

CREATE POLICY "comentarios update own" ON comentarios FOR
UPDATE
  USING (autor_id = auth.uid ())
  WITH CHECK (autor_id = auth.uid ());

CREATE POLICY "comentarios delete own" ON comentarios FOR DELETE USING (autor_id = auth.uid ());

-- RLS curtidas
ALTER TABLE curtidas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "curtidas select" ON curtidas;

DROP POLICY IF EXISTS "curtidas insert" ON curtidas;

DROP POLICY IF EXISTS "curtidas delete own" ON curtidas;

CREATE POLICY "curtidas select" ON curtidas FOR
SELECT
  USING (auth.role () = 'authenticated');

CREATE POLICY "curtidas insert" ON curtidas FOR INSERT
WITH CHECK (auth.role () = 'authenticated' AND usuario_id = auth.uid ());

CREATE POLICY "curtidas delete own" ON curtidas FOR DELETE USING (usuario_id = auth.uid ());

-- RLS item_salvo
ALTER TABLE item_salvo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "item_salvo select" ON item_salvo;

DROP POLICY IF EXISTS "item_salvo insert" ON item_salvo;

DROP POLICY IF EXISTS "item_salvo delete own" ON item_salvo;

CREATE POLICY "item_salvo select" ON item_salvo FOR
SELECT
  USING (auth.role () = 'authenticated' AND usuario_id = auth.uid ());

CREATE POLICY "item_salvo insert" ON item_salvo FOR INSERT
WITH CHECK (auth.role () = 'authenticated' AND usuario_id = auth.uid ());

CREATE POLICY "item_salvo delete own" ON item_salvo FOR DELETE USING (usuario_id = auth.uid ());

-- Marcar story como vista (evita abrir UPDATE amplo nas stories)
CREATE OR REPLACE FUNCTION append_story_viewer (sid UUID, viewer_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur JSONB;
  arr TEXT[];
  seen BOOLEAN := false;
  e TEXT;
BEGIN
  SELECT
    COALESCE(visualizado_por, '[]'::jsonb) INTO cur
  FROM
    stories
  WHERE
    id = sid
    AND expira_em > NOW ();

  IF NOT FOUND THEN
    RETURN;
  END IF;

  arr := ARRAY(SELECT jsonb_array_elements_text (cur));

  FOREACH e IN ARRAY arr LOOP
    IF e = viewer_email THEN
      seen := true;
      EXIT;
    END IF;
  END LOOP;

  IF seen THEN
    RETURN;
  END IF;

  UPDATE stories
  SET
    visualizado_por = cur || jsonb_build_array (viewer_email)
  WHERE
    id = sid;
END;
$$;

GRANT EXECUTE ON FUNCTION append_story_viewer (UUID, TEXT) TO authenticated;
