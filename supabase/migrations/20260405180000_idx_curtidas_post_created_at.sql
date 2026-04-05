-- Lista de curtidas por post ordenada por data (ModalCurtidas, contagens).
-- Coluna created_at já existe em 20260325230000_feed_stories.sql
CREATE INDEX IF NOT EXISTS idx_curtidas_post_id_created_at ON curtidas (post_id, created_at DESC NULLS LAST)
WHERE
  post_id IS NOT NULL;
