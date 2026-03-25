-- Correções Feed + Stories (executar após posts e stories — ver 20260325210000 e 20260325230000)
-- Inclui: RPC compartilhamentos, redecontatos, constraint tipo em stories

-- 1. Incrementar compartilhamentos no post original
CREATE OR REPLACE FUNCTION incrementar_compartilhamentos (post_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE posts
  SET
    total_compartilhamentos = COALESCE(total_compartilhamentos, 0) + 1
  WHERE
    id = post_id
    AND deleted_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION incrementar_compartilhamentos (UUID) TO authenticated;

-- 2. Seguir usuários (turista/profissional/empresa como perfil seguido)
CREATE TABLE IF NOT EXISTS redecontatos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  seguidor_id UUID NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  seguido_id UUID NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  seguido_tipo VARCHAR (20) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW (),
  UNIQUE (seguidor_id, seguido_id),
  CONSTRAINT redecontatos_nao_auto CHECK (seguidor_id <> seguido_id)
);

CREATE INDEX IF NOT EXISTS idx_redecontatos_seguidor ON redecontatos (seguidor_id);

CREATE INDEX IF NOT EXISTS idx_redecontatos_seguido ON redecontatos (seguido_id);

ALTER TABLE redecontatos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "redecontatos select" ON redecontatos;

DROP POLICY IF EXISTS "redecontatos insert" ON redecontatos;

DROP POLICY IF EXISTS "redecontatos delete own" ON redecontatos;

CREATE POLICY "redecontatos select" ON redecontatos FOR
SELECT
  USING (
    auth.role () = 'authenticated'
    AND (
      seguidor_id = auth.uid ()
      OR seguido_id = auth.uid ()
    )
  );

CREATE POLICY "redecontatos insert" ON redecontatos FOR INSERT
WITH CHECK (
  auth.role () = 'authenticated'
  AND seguidor_id = auth.uid ()
);

CREATE POLICY "redecontatos delete own" ON redecontatos FOR DELETE USING (seguidor_id = auth.uid ());

-- 3. Tipo de story: foto ou vídeo
ALTER TABLE stories DROP CONSTRAINT IF EXISTS stories_tipo_check;

ALTER TABLE stories
ADD CONSTRAINT stories_tipo_check CHECK (tipo IN ('foto', 'video'));

-- Coluna duracao opcional (já existe duracao_segundos; duracao só se ainda não existir em projetos legados)
ALTER TABLE stories
ADD COLUMN IF NOT EXISTS duracao INTEGER DEFAULT 60;

COMMENT ON COLUMN stories.duracao IS 'Legado; preferir duracao_segundos.';
