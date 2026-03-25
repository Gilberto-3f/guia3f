-- Feed: publicações + bucket de imagens
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  autor_id UUID NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  texto TEXT,
  foto_url TEXT,
  tipo TEXT DEFAULT 'texto',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posts_autor ON posts (autor_id);

CREATE INDEX IF NOT EXISTS idx_posts_created ON posts (created_at DESC);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "posts leitura autenticados" ON posts;

DROP POLICY IF EXISTS "posts insert próprio autor" ON posts;

DROP POLICY IF EXISTS "posts update próprio autor" ON posts;

DROP POLICY IF EXISTS "posts delete próprio autor" ON posts;

CREATE POLICY "posts leitura autenticados" ON posts FOR
SELECT
  USING (auth.role () = 'authenticated');

CREATE POLICY "posts insert próprio autor" ON posts FOR INSERT
WITH CHECK (
  auth.role () = 'authenticated'
  AND autor_id = auth.uid ()
);

CREATE POLICY "posts update próprio autor" ON posts FOR
UPDATE
  USING (autor_id = auth.uid ())
  WITH CHECK (autor_id = auth.uid ());

CREATE POLICY "posts delete próprio autor" ON posts FOR DELETE USING (autor_id = auth.uid ());

INSERT INTO
  storage.buckets (id, name, public)
VALUES
  ('posts', 'posts', TRUE)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "posts storage leitura pública" ON storage.objects;

DROP POLICY IF EXISTS "posts storage upload pasta do usuário" ON storage.objects;

DROP POLICY IF EXISTS "posts storage update próprio" ON storage.objects;

DROP POLICY IF EXISTS "posts storage delete próprio" ON storage.objects;

CREATE POLICY "posts storage leitura pública" ON storage.objects FOR
SELECT
  USING (bucket_id = 'posts');

CREATE POLICY "posts storage upload pasta do usuário" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'posts'
  AND (storage.foldername (name))[1] = auth.uid ()::text
);

CREATE POLICY "posts storage delete próprio" ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'posts'
  AND (storage.foldername (name))[1] = auth.uid ()::text
);
