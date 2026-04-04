-- Republicação: ligação ao post de origem + contador
ALTER TABLE posts
ADD COLUMN IF NOT EXISTS post_original_id UUID REFERENCES posts (id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS total_reposts INTEGER DEFAULT 0;

UPDATE posts
SET
  total_reposts = 0
WHERE
  total_reposts IS NULL;

CREATE INDEX IF NOT EXISTS idx_posts_post_original_id ON posts (post_original_id)
WHERE
  post_original_id IS NOT NULL;

CREATE OR REPLACE FUNCTION incrementar_reposts (post_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE posts
  SET
    total_reposts = COALESCE(total_reposts, 0) + 1
  WHERE
    id = post_id
    AND deleted_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION incrementar_reposts (UUID) TO authenticated;

COMMENT ON COLUMN posts.post_original_id IS 'Quando preenchido, este post é cópia completa de um republicado; aponta para o post que foi republicado.';

-- Se existir view `posts_com_autores` com lista explícita de colunas, inclua `post_original_id` e `total_reposts` (ou use SELECT * a partir de posts).
